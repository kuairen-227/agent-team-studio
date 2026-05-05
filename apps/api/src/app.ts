/**
 * Hono app の組み立て。
 *
 * 依存（repo 関数）を引数で受け取ることで、本番起動と fake repo を使ったテストの
 * 起動パスを共通化する。
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
