import { describe, expect, test } from "bun:test";
import type {
  ApiInternalError,
  ApiNotFoundError,
  ApiValidationError,
  CompetitorAnalysisParameters,
  CreateExecutionResponse,
  GetTemplateResponse,
  GetTemplatesResponse,
} from "@agent-team-studio/shared";
import { fixtureTemplate, fixtureTemplateSummaries } from "./_test-fixtures.ts";
import { type AppDeps, createApp } from "./app.ts";

const buildApp = (overrides: Partial<AppDeps> = {}) =>
  createApp({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => null,
    createExecution: async () => ({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    }),
    ...overrides,
  });

const validParameters: CompetitorAnalysisParameters = {
  competitors: ["Acme"],
};

const postExecutions = (app: ReturnType<typeof buildApp>, body: unknown) =>
  app.request("/api/executions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

describe("POST /api/executions", () => {
  test("正常系は 202 + CreateExecutionResponse 形を返す", async () => {
    const app = buildApp({
      getTemplateById: async () => fixtureTemplate,
      createExecution: async () => ({
        id: "exec-1",
        status: "pending",
        createdAt: "2026-05-04T00:00:00.000Z",
      }),
    });

    const res = await postExecutions(app, {
      templateId: fixtureTemplate.id,
      parameters: validParameters,
    });

    expect(res.status).toBe(202);
    const body = (await res.json()) as CreateExecutionResponse;
    expect(body).toEqual({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    });
  });

  test("Template 不在は 404 + ApiNotFoundError 形を返す", async () => {
    const app = buildApp({ getTemplateById: async () => null });

    const res = await postExecutions(app, {
      templateId: "tpl-missing",
      parameters: validParameters,
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiNotFoundError;
    expect(body.errorCode).toBe("not_found");
    expect(body.details).toEqual({ resource: "template", id: "tpl-missing" });
  });

  // route 層を経由した validation_error の整形のみを検証する。
  // 個別 field 名・境界値は service 層テスト（services/executions.test.ts）に委譲する。
  test("バリデーション失敗は 400 + ApiValidationError 形を返す", async () => {
    const app = buildApp({ getTemplateById: async () => fixtureTemplate });

    const res = await postExecutions(app, {
      templateId: fixtureTemplate.id,
      parameters: { competitors: [] },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiValidationError;
    expect(body.errorCode).toBe("validation_error");
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0]).toHaveProperty("field");
    expect(body.details[0]).toHaveProperty("reason");
  });

  // route 層が `as CreateExecutionRequest` でキャストした後に service の Zod が
  // `safeParse(undefined)` で受け止める経路を明示的に押さえる。
  test("parameters フィールド省略は 400 + ApiValidationError 形を返す", async () => {
    const app = buildApp({ getTemplateById: async () => fixtureTemplate });

    const res = await postExecutions(app, {
      templateId: fixtureTemplate.id,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiValidationError;
    expect(body.errorCode).toBe("validation_error");
    expect(body.details.length).toBeGreaterThan(0);
  });

  // route 層独自のエラー整形契約として field 名（"body"）まで明示する。
  // 本ケースは route 内 c.req.json() の throw 経路で、service 層の検証では再現できない。
  test("body が JSON でない場合は field='body' の ApiValidationError を返す", async () => {
    const app = buildApp();

    const res = await app.request("/api/executions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiValidationError;
    expect(body.errorCode).toBe("validation_error");
    expect(body.details).toEqual([
      { field: "body", reason: expect.any(String) },
    ]);
  });

  // onError ミドルウェアが ApiInternalError 形に整形する境界を検証する。
  // service 層の同種テストは「例外を握りつぶさず透過させる」契約を扱う（責務分担）。
  test("createExecution が例外を投げると 500 + ApiInternalError 形を返す", async () => {
    const app = buildApp({
      getTemplateById: async () => fixtureTemplate,
      createExecution: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await postExecutions(app, {
      templateId: fixtureTemplate.id,
      parameters: validParameters,
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    expect(body.errorCode).toBe("internal_error");
    expect(body.message).toBeTruthy();
    // 内部例外メッセージが API レスポンスに漏洩しないことを境界として固定する。
    expect(body.message).not.toContain("DB connection failed");
  });
});
