/**
 * apps/web の error tracking（Sentry）セットアップ。
 *
 * 選定根拠は ADR-0035（Sentry free / SaaS 採用）。本モジュールは SDK 組み込みを担う。
 *
 * - `VITE_SENTRY_DSN` 未設定時は初期化せず、送信を無効化する（DSN なしでも起動できる）。
 *   web の DSN は Vite の build-time でバンドルに埋め込まれ公開前提となる（ADR-0035）。
 * - `Sentry.init` の既定 integration（globalHandlers）が uncaught error /
 *   unhandled rejection を自動捕捉する。React の描画エラーは `Sentry.ErrorBoundary`
 *   （router.tsx）が捕捉する。
 * - 送信前に `redactSensitive`（@agent-team-studio/shared）で PII/機密を除去する。
 *   apps/api と同一の redaction ロジックを共有する。
 */

import {
  DEFAULT_SENSITIVE_KEYS,
  redactSensitive,
} from "@agent-team-studio/shared";
// namespace import は意図的。テストが `spyOn(Sentry, "init")` でモジュールオブジェクトの
// プロパティを差し替えるため、named import に変えると本番コードの束縛がスパイされず
// DSN ゲートのテストが機能しなくなる。
import * as Sentry from "@sentry/react";
import { isExpectedClientError } from "./api";

// Sentry への依存をこのモジュールに集約する。UI から使う ErrorBoundary も
// ここ経由で参照させ、SDK 差し替え時の変更箇所を一点に保つ（router.tsx で使用）。
export { ErrorBoundary } from "@sentry/react";

/**
 * Sentry を初期化する。DSN 未設定（空・undefined）時は何もしない。
 *
 * アプリ描画より前（main.tsx の最上部）で呼ぶこと。error tracking が主眼のため
 * performance トレースは送らない（free tier 枠の節約）。機密キー集合は shared の
 * `DEFAULT_SENSITIVE_KEYS` を apps/api と共有する。
 *
 * `dsn` は既定で `import.meta.env.VITE_SENTRY_DSN` を読むが、テストで DSN ゲートを
 * 検証できるよう注入可能にしている（api 側 `setupSentry` と対称）。
 */
export function initSentry(dsn = import.meta.env.VITE_SENTRY_DSN): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // performance トレースは送らない（free tier 枠の節約・apps/api と一貫）。
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: (event) => redactSensitive(event, DEFAULT_SENSITIVE_KEYS),
  });
}

/**
 * TanStack Query のエラーを Sentry に報告する（QueryCache の onError から呼ぶ）。
 *
 * 想定内のクライアントエラー（4xx）は UI 側で適切に扱われるため送信しない
 * （observability ノイズと free tier 枠の節約）。想定外（5xx・ネットワーク等）のみ送信する。
 */
export function reportQueryError(error: unknown): void {
  if (isExpectedClientError(error)) return;
  Sentry.captureException(error);
}
