/**
 * `GET /api/templates` / `GET /api/templates/:id` ルート。
 *
 * Service を引数で受け取る形（DI）にして、統合テストで service をモック差し替え
 * できるようにする。
 *
 * レスポンス形は `GetTemplatesResponse` / `GetTemplateResponse`
 * （`packages/shared/src/api-types.ts`）に従う。
 *
 * 不在時の 404 整形は `lib/errors.ts` の onError ミドルウェアに委譲する。
 */

import type {
  GetTemplateResponse,
  GetTemplatesResponse,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import type { TemplatesService } from "../services/templates.ts";

/** `GET /api/templates` と `GET /api/templates/:id` ルートを返すファクトリ。 */
export function createTemplatesRoutes(deps: {
  templatesService: TemplatesService;
}) {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await deps.templatesService.listTemplates();
    const body: GetTemplatesResponse = { items, total: items.length };
    return c.json(body);
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const template = await deps.templatesService.getTemplate(id);
    const body: GetTemplateResponse = {
      id: template.id,
      name: template.name,
      description: template.description,
      definition: template.definition,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
    return c.json(body);
  });

  return app;
}
