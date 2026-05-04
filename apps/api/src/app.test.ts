import { describe, expect, test } from "bun:test";
import type {
  ApiInternalError,
  ApiNotFoundError,
  GetTemplateResponse,
  GetTemplatesResponse,
} from "@agent-team-studio/shared";
import { fixtureTemplate, fixtureTemplateSummaries } from "./_test-fixtures.ts";
import { type AppDeps, createApp } from "./app.ts";

const buildApp = (overrides: Partial<AppDeps> = {}) =>
  createApp({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => null,
    ...overrides,
  });

describe("GET /api/templates", () => {
  test("repo の戻り値を items + total 形で 200 で返す", async () => {
    const app = buildApp({
      listTemplateSummaries: async () => fixtureTemplateSummaries,
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetTemplatesResponse;
    expect(body).toEqual({
      items: fixtureTemplateSummaries,
      total: fixtureTemplateSummaries.length,
    });
  });

  // onError ミドルウェアが ApiInternalError 形に整形することを境界として検証する。
  test("repo が例外を投げると 500 + ApiInternalError 形を返す", async () => {
    const app = buildApp({
      listTemplateSummaries: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    expect(body.errorCode).toBe("internal_error");
    expect(body.message).toBeTruthy();
  });
});

describe("GET /api/templates/:id", () => {
  test("repo が Template を返すと 200 + GetTemplateResponse 形で返す", async () => {
    const app = buildApp({ getTemplateById: async () => fixtureTemplate });

    const res = await app.request("/api/templates/tpl-1");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetTemplateResponse;
    expect(body).toEqual({
      id: fixtureTemplate.id,
      name: fixtureTemplate.name,
      description: fixtureTemplate.description,
      definition: fixtureTemplate.definition,
      createdAt: fixtureTemplate.created_at,
      updatedAt: fixtureTemplate.updated_at,
    });
  });

  test("repo が null を返すと 404 + ApiNotFoundError 形を返す", async () => {
    const app = buildApp({ getTemplateById: async () => null });

    const res = await app.request("/api/templates/tpl-missing");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiNotFoundError;
    expect(body.errorCode).toBe("not_found");
    expect(body.details).toEqual({ resource: "template", id: "tpl-missing" });
    expect(body.message).toBeTruthy();
  });

  test("repo が例外を投げると 500 + ApiInternalError 形を返す", async () => {
    const app = buildApp({
      getTemplateById: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/templates/tpl-1");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    expect(body.errorCode).toBe("internal_error");
    expect(body.message).toBeTruthy();
  });
});
