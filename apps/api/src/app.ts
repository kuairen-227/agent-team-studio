/**
 * Hono app の組み立て。
 *
 * `index.ts` から本番の DB クライアントを渡して起動するパスと、
 * `app.test.ts` から fake repo を渡して `app.request()` で叩くパスを共通化するため、
 * app の構築を関数として切り出す。
 *
 * 依存（templates の repo 関数）は引数で受け取り、内部で service を生成する。
 * route → service → repo の 3 層を貫通する点は ADR-0010 開発ワークフローに準拠。
 *
 * エラーは `lib/errors.ts` の onError で `ApiNotFoundError` / `ApiInternalError` 形に整形する。
 */

import type { CreateExecutionInput } from "@agent-team-studio/db";
import type {
  CreateExecutionResponse,
  Template,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { onError } from "./lib/errors.ts";
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
  });
  app.route("/api/executions", createExecutionsRoutes({ executionsService }));

  app.route("/ws", createWsRoutes());

  return app;
}
