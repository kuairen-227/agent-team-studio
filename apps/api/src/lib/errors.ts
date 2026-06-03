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
import { type AppEnv, logger } from "./logger.ts";

/** リソース不在を表す例外。`onError` が 404 レスポンスに整形する。 */
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

/** バリデーション失敗を表す例外。`onError` が 400 レスポンスに整形する。 */
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

/**
 * `NotFoundError`・`ValidationError`・その他例外を HTTP レスポンスに整形する Hono エラーハンドラ。
 *
 * `NotFoundError` / `ValidationError` は想定内の業務エラーのためログしない。
 * それ以外（内部例外）は 500 に集約しつつ、原因追跡のため request-id 付きで error ログを残す。
 */
export const onError: ErrorHandler<AppEnv> = (err, c) => {
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

  // request-scoped logger があれば使い、なければベースロガーへ退避する。
  // 通常フローでは requestId() と logger-bind middleware がルートハンドラより先に
  // 実行されるため、ルート/サービス層からの throw 時には logger は set 済み。
  // ただし logger-bind より前（requestId middleware 等）で throw した場合は未 set の
  // ため、ログを欠落させない安全網として ?? でベースロガーへ退避する。
  (c.get("logger") ?? logger).error({ err }, "unhandled internal error");

  const body: ApiInternalError = {
    errorCode: "internal_error",
    message: "一時的なエラーが発生しました。時間をおいて再度お試しください",
  };
  return c.json(body, 500);
};
