/**
 * `POST /api/executions` ルート。
 *
 * body の構造検証は service 側の Zod に委譲する。route 層は JSON parse 失敗のみ
 * `ValidationError` に整形して 400 を返す（field="body" で識別）。成功時は 202 Accepted。
 */

import type {
  CreateExecutionRequest,
  CreateExecutionResponse,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { ValidationError } from "../lib/errors.ts";
import type { ExecutionsService } from "../services/executions.ts";

export function createExecutionsRoutes(deps: {
  executionsService: ExecutionsService;
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
    return c.json(result, 202);
  });

  return app;
}
