/**
 * apps/api のエントリポイント。
 *
 * 本番起動: DATABASE_URL から DB クライアントを起こし、repo 関数を `createApp` に注入する。
 * 統合テストは `createApp` を直接呼ぶ（DB を立ち上げず repo をモックする）。
 *
 * Bun の serve には `fetch` と `websocket` の双方を渡す必要がある（hono/bun の規約）。
 */

import type { AgentEvent } from "@agent-team-studio/agent-core";
import { runExecution } from "@agent-team-studio/agent-core";
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
import { websocket } from "./lib/ws.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const { db } = createDbClient(databaseUrl);

const eventHub = createEventHub();

/**
 * Execution を取得してエンジンを起動する。
 * engine の `onEvent` コールバックで event hub に publish する。
 * engine が完了するまで非同期で実行される（呼び出し元は await しない）。
 */
async function launchEngine(executionId: string): Promise<void> {
  const [execution, agentExecs] = await Promise.all([
    getExecution(db, executionId),
    getAgentExecutionsByExecutionId(db, executionId),
  ]);
  if (!execution) {
    console.error(`[engine] execution not found: ${executionId}`);
    return;
  }
  const template = await getTemplateById(db, execution.templateId);
  if (!template) {
    console.error(`[engine] template not found: ${execution.templateId}`);
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
  startExecution: (executionId) => {
    launchEngine(executionId).catch((err) => {
      console.error(`[engine] failed for ${executionId}:`, err);
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
