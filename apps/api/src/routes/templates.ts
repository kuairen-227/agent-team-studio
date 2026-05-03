/**
 * `GET /api/templates` ルート。
 *
 * Service を引数で受け取る形（DI）にして、統合テストで service をモック差し替え
 * できるようにする。
 *
 * レスポンス形は `GetTemplatesResponse = ListResponse<TemplateSummary>`
 * （`packages/shared/src/api-types.ts`）に従う。
 */

import type { GetTemplatesResponse } from "@agent-team-studio/shared";
import { Hono } from "hono";
import type { TemplatesService } from "../services/templates.ts";

export function createTemplatesRoutes(deps: {
  templatesService: TemplatesService;
}) {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await deps.templatesService.listTemplates();
    const body: GetTemplatesResponse = { items, total: items.length };
    return c.json(body);
  });

  return app;
}
