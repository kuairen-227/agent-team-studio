/**
 * Hono app の組み立て。
 *
 * 依存（repo 関数）を引数で受け取ることで、本番起動と fake repo を使ったテストの
 * 起動パスを共通化する。
 */

import type { AgentEvent } from "@agent-team-studio/agent-core";
import type {
  AgentExecutionRow,
  CreateExecutionInput,
  ExecutionRow,
  ResultRow,
} from "@agent-team-studio/db";
import type {
  CreateExecutionResponse,
  Template,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { onError } from "./lib/errors.ts";
// API モジュール全体で Zod のロケールを日本語に統一する副作用 import。
// 個別 service ではなく app.ts で一括設定し、新しい service が追加されても
// import 順に依存しないようにする。
import "./lib/zod-config.ts";
import { createExecutionsRoutes } from "./routes/executions.ts";
import { createTemplatesRoutes } from "./routes/templates.ts";
import { createWsRoutes } from "./routes/ws.ts";
import { createExecutionsService } from "./services/executions.ts";
import { createTemplatesService } from "./services/templates.ts";

export type AppDeps = {
  listTemplateSummaries: () => Promise<TemplateSummary[]>;
  getTemplateById: (id: string) => Promise<Template | null>;
  createExecution: (
    input: CreateExecutionInput,
  ) => Promise<CreateExecutionResponse>;
  /** Execution の行を 1 件取得する。存在しない場合は null。 */
  getExecution: (id: string) => Promise<ExecutionRow | null>;
  /** Execution に紐づく全 AgentExecution 行を取得する。 */
  getAgentExecutionsByExecutionId: (
    executionId: string,
  ) => Promise<AgentExecutionRow[]>;
  /** Execution に紐づく Result 行を取得する。存在しない場合は null。 */
  getResultByExecutionId: (executionId: string) => Promise<ResultRow | null>;
  /** 全 Execution 行を新しい順で取得する。 */
  listExecutions: () => Promise<ExecutionRow[]>;
  /** 202 受理後に engine を非同期起動する（fire-and-forget）。 */
  startExecution: (executionId: string) => void;
  /**
   * Execution の AgentEvent を受け取るハンドラを登録し、解除関数を返す。
   * WS 切断時に解除関数を呼ぶこと。
   */
  subscribeToExecution: (
    executionId: string,
    handler: (event: AgentEvent) => void,
  ) => () => void;
};

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.onError(onError);

  app.get("/health", (c) => c.json({ status: "ok" }));

  const templatesService = createTemplatesService({
    listTemplateSummaries: deps.listTemplateSummaries,
    getTemplateById: deps.getTemplateById,
  });
  app.route("/api/templates", createTemplatesRoutes({ templatesService }));

  const executionsService = createExecutionsService({
    getTemplateById: deps.getTemplateById,
    createExecution: deps.createExecution,
    getExecution: deps.getExecution,
    getAgentExecutionsByExecutionId: deps.getAgentExecutionsByExecutionId,
    getResultByExecutionId: deps.getResultByExecutionId,
    listExecutions: deps.listExecutions,
  });
  app.route(
    "/api/executions",
    createExecutionsRoutes({
      executionsService,
      startExecution: deps.startExecution,
    }),
  );

  app.route(
    "/ws",
    createWsRoutes({
      executionsService,
      subscribeToExecution: deps.subscribeToExecution,
    }),
  );

  return app;
}
