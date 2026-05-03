import { describe, expect, test } from "bun:test";
import type {
  GetTemplatesResponse,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { createApp } from "./app.ts";

describe("GET /api/templates", () => {
  test("repo の戻り値を items + total 形で 200 で返す", async () => {
    const fixture: TemplateSummary[] = [
      {
        id: "tpl-1",
        name: "競合調査",
        description: "MVP テンプレート",
      },
    ];
    const app = createApp({
      listTemplateSummaries: async () => fixture,
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetTemplatesResponse;
    expect(body).toEqual({ items: fixture, total: 1 });
  });
});
