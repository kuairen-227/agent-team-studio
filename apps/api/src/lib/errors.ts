/**
 * REST エラーの内部表現と onError ミドルウェア。
 *
 * Service / Route 層は `NotFoundError` を throw し、`onError` ハンドラで
 * `ApiNotFoundError` 形（`packages/shared/src/api-types.ts`）+ HTTP 404 に整形する。
 *
 * 内部例外（DB 接続失敗等）は `internal_error` (500) として `ApiInternalError` に
 * 整形する。詳細漏洩を避けるため `details` は MVP では返さない（api-design.md §エラーレスポンス）。
 */

import type {
  ApiInternalError,
  ApiNotFoundError,
} from "@agent-team-studio/shared";
import type { ErrorHandler } from "hono";

export class NotFoundError extends Error {
  constructor(
    readonly resource: ApiNotFoundError["details"]["resource"],
    readonly id: string,
    message?: string,
  ) {
    super(message ?? `${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

const NOT_FOUND_MESSAGES: Record<
  ApiNotFoundError["details"]["resource"],
  string
> = {
  template: "指定されたテンプレートが見つかりません",
  execution: "指定された実行が見つかりません",
};

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof NotFoundError) {
    const body: ApiNotFoundError = {
      errorCode: "not_found",
      message: NOT_FOUND_MESSAGES[err.resource],
      details: { resource: err.resource, id: err.id },
    };
    return c.json(body, 404);
  }

  const body: ApiInternalError = {
    errorCode: "internal_error",
    message: "一時的なエラーが発生しました。時間をおいて再度お試しください",
  };
  return c.json(body, 500);
};
