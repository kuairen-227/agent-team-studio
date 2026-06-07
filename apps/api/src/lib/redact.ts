/**
 * apps/api の機密フィールド redact 定義。
 *
 * 構造化ログ（Pino, ADR-0033）と error tracking（Sentry, ADR-0035）は同一の機密フィールド
 * 集合を redact する必要がある。両者で定義が乖離すると片方だけ漏れる事故につながるため、
 * 機密フィールド名をここに一元化し、Pino の redact paths と Sentry の beforeSend redactor の
 * 双方をここから導出する。再帰 redaction 本体は `@agent-team-studio/shared` の
 * `redactSensitive` を共有する（apps/web と同一ロジック）。
 *
 * 対象: authorization / cookie / apiKey / token / password（詳細は docs/design/logging.md）。
 */

import {
  DEFAULT_SENSITIVE_KEYS,
  redactSensitive,
} from "@agent-team-studio/shared";

// ヘッダとして扱う機密キー（Pino では `req.headers.<name>` 配下のみ redact する）。
// これ以外の DEFAULT_SENSITIVE_KEYS はボディ・任意オブジェクトのフィールドとして扱う。
const HEADER_KEYS: readonly string[] = ["authorization", "cookie"];

/**
 * Pino の redact paths。`DEFAULT_SENSITIVE_KEYS` から直接導出することで、機密キーを
 * 追加した際に Pino 側だけ redact 漏れが生じることを防ぐ（Sentry の `redactEvent` も
 * 同じ集合を使うため両者が乖離しない）。
 *
 * ヘッダ系キーは `req.headers.<name>`、それ以外はトップレベルと `*.<field>` を併記する。
 * pino の `*` は単一階層ワイルドカードで再帰 `**` は非対応のため（任意深度は非対応。
 * 詳細は docs/design/logging.md）。
 */
export const pinoRedactPaths: string[] = DEFAULT_SENSITIVE_KEYS.flatMap(
  (key) =>
    HEADER_KEYS.includes(key) ? [`req.headers.${key}`] : [key, `*.${key}`],
);

/**
 * Sentry の `beforeSend` 用 redactor。イベント内の機密フィールドを伏せて返す。
 *
 * 外部 SaaS（sentry.io）へ送信される前に PII/機密を除去する目的（ADR-0035）。
 * 機密キー集合は shared の `DEFAULT_SENSITIVE_KEYS` を apps/web と共有する。
 * pino の単一階層 redact と異なり任意深度を走査する。
 */
export function redactEvent<T>(event: T): T {
  return redactSensitive(event, DEFAULT_SENSITIVE_KEYS);
}
