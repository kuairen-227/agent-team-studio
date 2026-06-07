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
import * as Sentry from "@sentry/react";
import { isExpectedClientError } from "./api";

/**
 * Sentry を初期化する。`VITE_SENTRY_DSN` 未設定時は何もしない。
 *
 * アプリ描画より前（main.tsx の最上部）で呼ぶこと。error tracking が主眼のため
 * performance トレースは送らない（free tier 枠の節約）。機密キー集合は shared の
 * `DEFAULT_SENSITIVE_KEYS` を apps/api と共有する。
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
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
