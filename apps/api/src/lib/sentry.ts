/**
 * apps/api の error tracking（Sentry）セットアップ。
 *
 * 選定根拠は ADR-0035（Sentry free / SaaS 採用）。本モジュールは SDK 組み込みを担う。
 *
 * - `SENTRY_DSN` 未設定時は送信を無効化する（ローカル開発で DSN なしでも起動できる）。
 * - 送信前に `redactEvent`（redact.ts）で PII/機密を除去する（外部 SaaS 送信のため必須）。
 * - 業務エラー（NotFoundError / ValidationError = 400/404）は送信せず、内部例外（500）のみ
 *   送信する。構造化ログ（ADR-0033）の onError がこれらをログしない方針と整合する。
 *
 * trace ID(=X-Request-Id) は `tagRequestId` で Sentry の tag に乗せ、ログ↔エラーを
 * 突き合わせられるようにする（#239 / ADR-0035）。
 */

import { captureException, sentry, setTag } from "@sentry/hono/bun";
import type { Hono } from "hono";
import { NotFoundError, ValidationError } from "./errors.ts";
import type { AppEnv } from "./logger.ts";
import { redactEvent } from "./redact.ts";

// fire-and-forget 経路（index.ts）から例外送信に使う。Sentry 未初期化時（DSN 未設定）は no-op。
export { captureException };

/**
 * Hono app に Sentry ミドルウェアを組み込む。`SENTRY_DSN` 未設定時は何もせず false を返す。
 *
 * `applyPatches` の制約上、ルート登録（`app.route`）より前に呼ぶこと。
 * middleware が内部で `Sentry.init` を呼ぶため、これ以降は `captureException` 等の
 * グローバル API が有効になる（fire-and-forget 経路からの送信に必要）。
 */
export function setupSentry(app: Hono<AppEnv>): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  sentry(app, {
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // error tracking が主眼のため performance トレースは送らない（free tier 枠の節約）。
    tracesSampleRate: 0,
    // IP・cookie 等のデフォルト PII を送らない。加えて beforeSend で機密フィールドを除去する。
    sendDefaultPii: false,
    beforeSend: (event) => redactEvent(event),
    // 業務エラーは送信対象外。それ以外（内部例外）のみ送信する。
    shouldHandleError: (error) =>
      !(error instanceof NotFoundError || error instanceof ValidationError),
  });
  return true;
}

/**
 * 現在のリクエストスコープに trace ID(=request-id) を tag 付与する。
 *
 * Sentry Hono ミドルウェアが確立した per-request の isolation scope 内から呼ぶこと
 * （= `app.use` のリクエストコールバック内）。scope 外から呼ぶと別リクエストの scope に
 * 書き込まれうる。Sentry 未初期化時（DSN 未設定）は no-op で安全に呼べる。
 */
export function tagRequestId(requestId: string): void {
  setTag("requestId", requestId);
}
