/**
 * 機密フィールドの汎用 redactor。
 *
 * error tracking（Sentry, ADR-0035）では外部 SaaS（sentry.io）へイベントを送信する前に
 * PII/機密フィールドを除去する必要がある。apps/api / apps/web が同一の redaction ロジックを
 * 共有することで、片方だけ漏れる事故を防ぐ（機密キー集合は各アプリが文脈に応じて与える）。
 *
 * 機密キーの基準集合（authorization / cookie / apiKey / token / password）と運用方針は
 * docs/design/logging.md を SSoT とする。
 */

/** 値を伏せる際の置換文字列。 */
const CENSOR = "[REDACTED]";

/**
 * redact 対象の機密フィールド名の既定集合（SSoT）。
 *
 * apps/api / apps/web の Sentry `beforeSend` はこの集合を共有し、片方だけ更新されて
 * PII が漏れる事故を防ぐ。apps/api の Pino redact paths もこの集合と整合させる
 * （`apps/api/src/lib/redact.ts`）。基準・運用方針は docs/design/logging.md を参照。
 */
export const DEFAULT_SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "apiKey",
  "api_key",
  "token",
  "password",
] as const;

/**
 * `value` を再帰的に走査し、`sensitiveKeys` に一致するキーの値を `[REDACTED]` に
 * 置換して返す（in-place で書き換え、同じ参照を返す）。
 *
 * - キー名は大文字小文字を無視して判定する（`Authorization` 等の表記揺れに対応）。
 * - 任意深度・配列要素も走査する。循環参照は検出してスキップする。
 * - プリミティブ・null・undefined はそのまま返す。
 */
export function redactSensitive<T>(
  value: T,
  sensitiveKeys: Iterable<string>,
): T {
  const keySet = new Set<string>();
  for (const k of sensitiveKeys) keySet.add(k.toLowerCase());
  redactInPlace(value, keySet, new WeakSet());
  return value;
}

function redactInPlace(
  value: unknown,
  keySet: Set<string>,
  seen: WeakSet<object>,
): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) redactInPlace(item, keySet, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (keySet.has(key.toLowerCase())) {
      record[key] = CENSOR;
    } else {
      redactInPlace(record[key], keySet, seen);
    }
  }
}
