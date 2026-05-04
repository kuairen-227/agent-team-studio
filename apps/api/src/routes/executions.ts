/**
 * `POST /api/executions` ルート。
 *
 * Service を引数で受け取り（DI）、Hono の `c.req.json()` で受信した body をそのまま
 * service へ渡す。body の構造妥当性（templateId / parameters の存在）は service 側の
 * Zod で検証する。
 *
 * JSON parse 失敗（壊れた body）は `ValidationError` に整形して 400 を返す。
 *
 * 成功時は 202 Accepted（api-design.md §HTTP メソッド 非同期処理開始）。
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
