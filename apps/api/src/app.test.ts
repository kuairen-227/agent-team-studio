import { describe, expect, test } from "bun:test";
import type {
  AgentExecutionRow,
  ExecutionRow,
  ResultRow,
} from "@agent-team-studio/db";
import type {
  ApiInternalError,
  ApiNotFoundError,
  ApiValidationError,
  CompetitorAnalysisParameters,
  CreateExecutionResponse,
  GetExecutionResponse,
  GetExecutionsResponse,
  GetTemplateResponse,
  GetTemplatesResponse,
} from "@agent-team-studio/shared";
import { fixtureTemplate, fixtureTemplateSummaries } from "./_test-fixtures.ts";
import { type AppDeps, createApp } from "./app.ts";
import { logger } from "./lib/logger.ts";

const buildApp = (overrides: Partial<AppDeps> = {}) =>
  createApp({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => null,
    createExecution: async () => ({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    }),
    getExecution: async () => null,
    getAgentExecutionsByExecutionId: async () => [],
    getResultByExecutionId: async () => null,
    listExecutions: async () => [],
    startExecution: () => {},
    subscribeToExecution: () => () => {},
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

/** アクセスログ middleware が 1 リクエストごとに出力する行（#256）。 */
type AccessLogEntry = {
  msg: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
};

/**
 * リクエスト実行中の stdout を捕捉し、アクセスログ（`"request completed"`）行を返す。
 *
 * pino のベースロガー（singleton）は stdout へ JSON を書くため、書き込みを差し替えて捕捉する。
 * テスト環境のロガーは silent 既定（logger.test.ts）なので、捕捉の間だけ level を info に上げる。
 * いずれも `finally` で必ず復元する。
 */
async function captureAccessLog<T>(
  makeRequest: () => T | Promise<T>,
): Promise<{ result: T; accessLog?: AccessLogEntry }> {
  const lines: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  const savedLevel = logger.level;
  logger.level = "info";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    lines.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
    );
    return true;
  }) as typeof process.stdout.write;

  let result: T;
  try {
    result = await makeRequest();
  } finally {
    process.stdout.write = originalWrite;
    logger.level = savedLevel;
  }

  const accessLog = lines
    .map((line) => {
      try {
        return JSON.parse(line) as AccessLogEntry;
      } catch {
        return undefined;
      }
    })
    .find((entry) => entry?.msg === "request completed");
  return { result, accessLog };
}

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
    expect(body.message).not.toContain("DB connection failed");
  });

  // #239: 内部エラー時に details.traceId を露出し、X-Request-Id と一致させる。
  test("500 応答の details.traceId が X-Request-Id ヘッダと一致する", async () => {
    const app = buildApp({
      listTemplateSummaries: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/templates");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    const traceId = body.details?.traceId;
    expect(traceId).toBeTruthy();
    expect(res.headers.get("X-Request-Id")).toBe(traceId ?? null);
    // logging.md の trace ID 生成方針（RFC 4122 v4 UUID）に一致すること。
    // hono/request-id の既定ジェネレータ形式が変わった場合に気づける。
    expect(traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
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
    expect(body.message).not.toContain("DB connection failed");
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

  // #239: API→engine 境界での trace ID 伝搬の入口を固定する。
  // route が c.get("requestId") を startExecution に渡し忘れた場合に検出できる。
  test("startExecution に executionId と v4 UUID 形式の traceId が渡る", async () => {
    let captured: { executionId: string; traceId: string } | undefined;
    const app = buildApp({
      getTemplateById: async () => fixtureTemplate,
      createExecution: async () => ({
        id: "exec-1",
        status: "pending",
        createdAt: "2026-05-04T00:00:00.000Z",
      }),
      startExecution: (executionId, traceId) => {
        captured = { executionId, traceId };
      },
    });

    const res = await postExecutions(app, {
      templateId: fixtureTemplate.id,
      parameters: validParameters,
    });

    expect(res.status).toBe(202);
    // 未呼び出し（captured===undefined）と引数誤りを区別できるよう先に存在を固定する。
    expect(captured).toBeDefined();
    expect(captured?.executionId).toBe("exec-1");
    // X-Request-Id（=trace ID）と同形式の v4 UUID であること（logging.md）。
    expect(res.headers.get("X-Request-Id")).toBe(captured?.traceId ?? null);
    expect(captured?.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
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

describe("GET /api/executions", () => {
  const execRow1: ExecutionRow = {
    id: "exec-1",
    templateId: "tpl-1",
    parameters: { competitors: ["Acme"] },
    status: "completed",
    errorMessage: null,
    createdAt: new Date("2026-05-05T00:00:00.000Z"),
    startedAt: new Date("2026-05-05T00:01:00.000Z"),
    completedAt: new Date("2026-05-05T00:02:00.000Z"),
  };
  const execRow2: ExecutionRow = {
    id: "exec-2",
    templateId: "tpl-1",
    parameters: { competitors: ["Beta"] },
    status: "running",
    errorMessage: null,
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    startedAt: new Date("2026-05-04T00:01:00.000Z"),
    completedAt: null,
  };

  test("repo の戻り値を items + total 形で 200 で返す", async () => {
    const app = buildApp({ listExecutions: async () => [execRow1, execRow2] });

    const res = await app.request("/api/executions");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetExecutionsResponse;
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.id).toBe("exec-1");
    expect(body.items[0]?.templateId).toBe("tpl-1");
    expect(body.items[0]?.status).toBe("completed");
    expect(body.items[0]?.createdAt).toBe("2026-05-05T00:00:00.000Z");
    expect(body.items[0]?.startedAt).toBe("2026-05-05T00:01:00.000Z");
    expect(body.items[0]?.completedAt).toBe("2026-05-05T00:02:00.000Z");
    expect(body.items[1]?.id).toBe("exec-2");
    expect(body.items[1]?.templateId).toBe("tpl-1");
    expect(body.items[1]?.status).toBe("running");
    expect(body.items[1]?.createdAt).toBe("2026-05-04T00:00:00.000Z");
    expect(body.items[1]?.startedAt).toBe("2026-05-04T00:01:00.000Z");
    expect(body.items[1]?.completedAt).toBeUndefined();
  });

  test("0 件は items=[] + total=0 を返す", async () => {
    const app = buildApp({ listExecutions: async () => [] });

    const res = await app.request("/api/executions");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetExecutionsResponse;
    expect(body).toEqual({ items: [], total: 0 });
  });

  test("repo が例外を投げると 500 + ApiInternalError 形を返す", async () => {
    const app = buildApp({
      listExecutions: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/executions");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    expect(body.errorCode).toBe("internal_error");
    expect(body.message).toBeTruthy();
    expect(body.message).not.toContain("DB connection failed");
  });
});

describe("GET /api/executions/:id", () => {
  const execRow: ExecutionRow = {
    id: "exec-1",
    templateId: "tpl-1",
    parameters: { competitors: ["Acme", "Globex"] },
    status: "completed",
    errorMessage: null,
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    startedAt: new Date("2026-05-04T00:01:00.000Z"),
    completedAt: new Date("2026-05-04T00:02:00.000Z"),
  };

  const agentRow: AgentExecutionRow = {
    id: "ae-1",
    executionId: "exec-1",
    agentId: "investigation_strategy",
    role: "investigation",
    status: "completed",
    output: null,
    errorMessage: null,
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    startedAt: new Date("2026-05-04T00:01:00.000Z"),
    completedAt: new Date("2026-05-04T00:02:00.000Z"),
  };

  const resultRow: ResultRow = {
    id: "result-1",
    executionId: "exec-1",
    markdown: "# レポート",
    structured: {
      matrix: [],
      overall_insights: [{ text: "所見1" }],
      missing: [],
    },
    createdAt: new Date("2026-05-04T00:02:00.000Z"),
  };

  test("Execution が存在するとき 200 + GetExecutionResponse 形を返す", async () => {
    const app = buildApp({
      getExecution: async () => execRow,
      getAgentExecutionsByExecutionId: async () => [agentRow],
      getResultByExecutionId: async () => resultRow,
    });

    const res = await app.request("/api/executions/exec-1");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetExecutionResponse;
    expect(body.id).toBe("exec-1");
    expect(body.status).toBe("completed");
    expect(body.agentExecutions).toHaveLength(1);
    expect(body.agentExecutions[0]?.id).toBe("ae-1");
    expect(body.agentExecutions[0]?.role).toBe("investigation");
    expect(body.result?.id).toBe("result-1");
    expect(body.result?.markdown).toBe("# レポート");
    expect(body.result?.structured.overall_insights).toEqual([
      { text: "所見1" },
    ]);
    expect(body.result?.structured.matrix).toEqual([]);
    expect(body.result?.structured.missing).toEqual([]);
  });

  test("Execution が存在しないとき 404 + ApiNotFoundError 形を返す", async () => {
    const app = buildApp({ getExecution: async () => null });

    const res = await app.request("/api/executions/exec-missing");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiNotFoundError;
    expect(body.errorCode).toBe("not_found");
    expect(body.details).toEqual({ resource: "execution", id: "exec-missing" });
    expect(body.message).toBeTruthy();
  });

  test("repo が例外を投げると 500 + ApiInternalError 形を返す", async () => {
    const app = buildApp({
      getExecution: async () => {
        throw new Error("DB connection failed");
      },
    });

    const res = await app.request("/api/executions/exec-1");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiInternalError;
    expect(body.errorCode).toBe("internal_error");
    expect(body.message).toBeTruthy();
    expect(body.message).not.toContain("DB connection failed");
  });

  // WS 設計上 completed 時に result 欠落は起きないが、route 層の境界として固定する。
  test("Execution が存在し result が null のとき 200 + result=undefined を返す", async () => {
    const app = buildApp({
      getExecution: async () => execRow,
      getAgentExecutionsByExecutionId: async () => [agentRow],
      getResultByExecutionId: async () => null,
    });

    const res = await app.request("/api/executions/exec-1");

    expect(res.status).toBe(200);
    const body = (await res.json()) as GetExecutionResponse;
    expect(body.id).toBe("exec-1");
    expect(body.result).toBeUndefined();
  });
});

// #256: throw 経路（onError 整形の 400/404/500）でもアクセスログが出力され、
// status が実レスポンスと一致することを固定する。Hono の compose は throw を捕捉した
// 階層内で onError を同期実行して c.res を確定するため、middleware の `await next()` 後の
// ログ出力時点では status が反映済みになる（docs/design/logging.md）。
// 将来 middleware を try/catch+rethrow 等へ変えてエラー経路のログを落とす退行を検知する。
describe("アクセスログの全経路網羅", () => {
  test("400（validation）経路でアクセスログが status=400 で出力される", async () => {
    const app = buildApp();
    const { result: res, accessLog } = await captureAccessLog(() =>
      app.request("/api/executions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(res.status).toBe(400);
    expect(accessLog).toBeDefined();
    expect(accessLog?.status).toBe(400);
    expect(accessLog?.method).toBe("POST");
    expect(accessLog?.path).toBe("/api/executions");
    expect(typeof accessLog?.latencyMs).toBe("number");
  });

  test("404（NotFoundError）経路でアクセスログが status=404 で出力される", async () => {
    const app = buildApp({ getTemplateById: async () => null });
    const { result: res, accessLog } = await captureAccessLog(() =>
      app.request("/api/templates/tpl-missing"),
    );

    expect(res.status).toBe(404);
    expect(accessLog?.status).toBe(404);
    expect(accessLog?.method).toBe("GET");
    expect(accessLog?.path).toBe("/api/templates/tpl-missing");
  });

  test("500（throw）経路でアクセスログが status=500 で出力される", async () => {
    const app = buildApp({
      listTemplateSummaries: async () => {
        throw new Error("DB connection failed");
      },
    });
    const { result: res, accessLog } = await captureAccessLog(() =>
      app.request("/api/templates"),
    );

    expect(res.status).toBe(500);
    expect(accessLog?.status).toBe(500);
    expect(accessLog?.path).toBe("/api/templates");
  });
});
