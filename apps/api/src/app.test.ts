import { describe, expect, test } from "bun:test";
import type {
  GetTemplatesResponse,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { createApp } from "./app.ts";

const singleTemplate: TemplateSummary[] = [
  {
    id: "tpl-1",
    name: "競合調査",
    description: "MVP テンプレート",
  },
];

describe("GET /api/templates", () => {
  test("repo の戻り値を items + total 形で 200 で返す", async () => {
    const app = createApp({
      listTemplateSummaries: async () => singleTemplate,
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetTemplatesResponse;
    expect(body).toEqual({ items: singleTemplate, total: 1 });
  });

  // Hono のデフォルトエラーハンドリングが 500 を返すことを境界として検証する。
  // レスポンスボディの ApiInternalError 形への整形（onError ミドルウェア導入）は
  // US-1 以降の実エラーパス整備時に行う。
  test("repo が例外を投げると 500 を返す", async () => {
    const app = createApp({
      listTemplateSummaries: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(500);
  });
});
