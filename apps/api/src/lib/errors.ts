/**
 * REST エラーの内部表現と onError ミドルウェア。
 *
 * Service / Route 層は `NotFoundError` / `ValidationError` を throw し、`onError`
 * ハンドラで API レスポンス形 + HTTP ステータスに整形する。内部例外（DB 接続失敗等）は
 * `internal_error` (500) に集約し、詳細漏洩を避けるため `details` は返さない。
 */

import type {
  ApiInternalError,
  ApiNotFoundError,
  ApiValidationError,
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

export class ValidationError extends Error {
  constructor(
    readonly details: ApiValidationError["details"],
    message?: string,
  ) {
    super(message ?? "validation failed");
    this.name = "ValidationError";
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
  if (err instanceof ValidationError) {
    const body: ApiValidationError = {
      errorCode: "validation_error",
      message: "入力に誤りがあります",
      details: err.details,
    };
    return c.json(body, 400);
  }

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
