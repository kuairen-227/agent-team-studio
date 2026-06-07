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

import { redactSensitive } from "@agent-team-studio/shared";

/** リクエストヘッダ上の機密キー（Pino では `req.headers.<name>` として redact）。 */
const SENSITIVE_HEADERS = ["authorization", "cookie"] as const;

/** ボディ・任意オブジェクト上の機密フィールド名。 */
const SENSITIVE_FIELDS = ["apiKey", "api_key", "token", "password"] as const;

/**
 * Pino の redact paths。
 *
 * pino の `*` は単一階層ワイルドカードで再帰 `**` は非対応のため、トップレベルと
 * `*.<field>` を併記する（任意深度は非対応。詳細は docs/design/logging.md）。
 */
export const pinoRedactPaths: string[] = [
  ...SENSITIVE_HEADERS.map((h) => `req.headers.${h}`),
  ...SENSITIVE_FIELDS.flatMap((f) => [f, `*.${f}`]),
];

/** Sentry の beforeSend で走査する機密キー集合（ヘッダ・フィールドの和）。 */
const SENTRY_SENSITIVE_KEYS = [...SENSITIVE_HEADERS, ...SENSITIVE_FIELDS];

/**
 * Sentry の `beforeSend` 用 redactor。イベント内の機密フィールドを伏せて返す。
 *
 * 外部 SaaS（sentry.io）へ送信される前に PII/機密を除去する目的（ADR-0035）。
 * pino の単一階層 redact と異なり任意深度を走査する。
 */
export function redactEvent<T>(event: T): T {
  return redactSensitive(event, SENTRY_SENSITIVE_KEYS);
}
