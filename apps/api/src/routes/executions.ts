/**
 * `/api/executions` ルート。
 *
 * - `POST /`: Execution 作成（202 Accepted）+ engine 非同期起動
 * - `GET /`: Execution 一覧
 * - `GET /:id`: Execution 詳細
 *
 * body の構造検証は service 側の Zod に委譲する。route 層は JSON parse 失敗のみ
 * `ValidationError` に整形して 400 を返す（field="body" で識別）。
 */

import type {
  CreateExecutionRequest,
  CreateExecutionResponse,
  GetExecutionResponse,
  GetExecutionsResponse,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { NotFoundError, ValidationError } from "../lib/errors.ts";
import type { ExecutionsService } from "../services/executions.ts";

export function createExecutionsRoutes(deps: {
  executionsService: ExecutionsService;
  startExecution: (executionId: string) => void;
}) {
  const app = new Hono();

  app.post("/", async (c) => {
    let body: CreateExecutionRequest;
    try {
      body = (await c.req.json()) as CreateExecutionRequest;
    } catch {
      throw new ValidationError([
        { field: "body", reason: "リクエスト本文が JSON として不正です" },
      ]);
    }

    const result: CreateExecutionResponse =
      await deps.executionsService.createExecution(body);

    // 202 を返してから engine を非同期起動する（fire-and-forget）。
    deps.startExecution(result.id);

    return c.json(result, 202);
  });

  app.get("/", async (c) => {
    const result: GetExecutionsResponse =
      await deps.executionsService.listExecutions();
    return c.json(result, 200);
  });

  app.get("/:id", async (c) => {
    const { id } = c.req.param();
    const result: GetExecutionResponse | null =
      await deps.executionsService.getExecution(id);
    if (!result) {
      throw new NotFoundError("execution", id);
    }
    return c.json(result, 200);
  });

  return app;
}
