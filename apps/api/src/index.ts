/**
 * apps/api のエントリポイント。
 *
 * 本番起動: DATABASE_URL から DB クライアントを起こし、repo 関数を `createApp` に注入する。
 * 統合テストは `createApp` を直接呼ぶ（DB を立ち上げず repo をモックする）。
 *
 * Bun の serve には `fetch` と `websocket` の双方を渡す必要がある（hono/bun の規約）。
 */

import type {
  AgentEvent,
  Logger,
  WebSearchPort,
} from "@agent-team-studio/agent-core";
import {
  createTavilyWebSearch,
  runExecution,
} from "@agent-team-studio/agent-core";
import type { AgentExecutionRow } from "@agent-team-studio/db";
import {
  createDbClient,
  createExecution,
  getAgentExecutionsByExecutionId,
  getExecution,
  getResultByExecutionId,
  getTemplateById,
  insertResult,
  listExecutions,
  listTemplateSummaries,
  updateAgentExecution,
  updateExecution,
} from "@agent-team-studio/db";
import type { AgentRole } from "@agent-team-studio/shared";
import { createApp } from "./app.ts";
import { createEventHub } from "./lib/event-hub.ts";
import { logger } from "./lib/logger.ts";
import { captureException } from "./lib/sentry.ts";
import { websocket } from "./lib/ws.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const { db } = createDbClient(databaseUrl);

const eventHub = createEventHub();

/**
 * Web 検索境界（#323 / ADR-0045）。`TAVILY_API_KEY` 設定時のみ Tavily port を起こして
 * engine に注入する。未設定なら undefined のままで、調査エージェントは knowledge_base
 * 動作へ縮退する（外部キー無し環境でも起動・実行できる。secret 管理は ADR-0039）。
 */
const tavilyApiKey = process.env.TAVILY_API_KEY;
const webSearch: WebSearchPort | undefined = tavilyApiKey
  ? createTavilyWebSearch({ apiKey: tavilyApiKey })
  : undefined;
if (!webSearch) {
  logger.warn(
    {},
    "TAVILY_API_KEY is not set; investigation runs fall back to knowledge_base sources",
  );
}

/**
 * Execution を取得してエンジンを起動する。
 *
 * `engineLogger` は呼び出し元が trace ID(=request-id) と executionId を bind 済みの
 * child logger。これを runExecution に注入することで API→engine→LLM のログが同一
 * trace ID で引ける（#239）。
 * engine の `onEvent` コールバックで event hub に publish する。
 * engine が完了するまで非同期で実行される（呼び出し元は await しない）。
 */
async function launchEngine(
  executionId: string,
  engineLogger: Logger,
): Promise<void> {
  const [execution, agentExecs] = await Promise.all([
    getExecution(db, executionId),
    getAgentExecutionsByExecutionId(db, executionId),
  ]);
  if (!execution) {
    engineLogger.error({ executionId }, "execution not found");
    eventHub.publish(executionId, {
      kind: "execution_failed",
      reason: "internal_error",
    });
    return;
  }
  const template = await getTemplateById(db, execution.templateId);
  if (!template) {
    engineLogger.error(
      { executionId, templateId: execution.templateId },
      "template not found",
    );
    eventHub.publish(executionId, {
      kind: "execution_failed",
      reason: "internal_error",
    });
    return;
  }

  await runExecution(
    {
      executionId,
      parameters: execution.parameters,
      templateDefinition: template.definition,
      agentExecutions: agentExecs.map((ae: AgentExecutionRow) => ({
        id: ae.id,
        agentId: ae.agentId,
        role: ae.role as AgentRole,
      })),
    },
    {
      updateExecution: (id, patch) => updateExecution(db, id, patch),
      updateAgentExecution: (id, patch) => updateAgentExecution(db, id, patch),
      insertResult: (input) => insertResult(db, input),
      onEvent: (event: AgentEvent) => eventHub.publish(executionId, event),
      logger: engineLogger,
      webSearch,
    },
  );
}

const app = createApp({
  listTemplateSummaries: () => listTemplateSummaries(db),
  getTemplateById: (id) => getTemplateById(db, id),
  createExecution: (input) => createExecution(db, input),
  getExecution: (id) => getExecution(db, id),
  getAgentExecutionsByExecutionId: (executionId) =>
    getAgentExecutionsByExecutionId(db, executionId),
  getResultByExecutionId: (executionId) =>
    getResultByExecutionId(db, executionId),
  listExecutions: () => listExecutions(db),
  startExecution: (executionId, traceId) => {
    // POST /api/executions の request-id を trace ID として engine 経路へ伝搬する。
    const engineLogger = logger.child({
      component: "engine",
      requestId: traceId,
      executionId,
    });
    launchEngine(executionId, engineLogger).catch((err) => {
      engineLogger.error({ err }, "engine failed");
      // fire-and-forget 経路は HTTP リクエストの外側で実行されるため Sentry の
      // Hono ミドルウェアでは捕捉されない。未キャッチ例外を明示的に送信する（ADR-0035）。
      captureException(err, { tags: { requestId: traceId, executionId } });
      eventHub.publish(executionId, {
        kind: "execution_failed",
        reason: "internal_error",
      });
    });
  },
  subscribeToExecution: (executionId, handler) =>
    eventHub.subscribe(executionId, handler),
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

export default {
  port,
  fetch: app.fetch,
  websocket,
};
