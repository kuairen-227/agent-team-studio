/**
 * `redactSensitive` の単体テスト。
 *
 * error tracking（Sentry, ADR-0035）で外部 SaaS へ送信する前に PII/機密を除去する
 * 汎用 redactor。apps/api / apps/web の双方が同一ロジックを共有する SSoT。
 */

import { describe, expect, test } from "bun:test";
import { redactSensitive } from "./redact.ts";

const KEYS = [
  "authorization",
  "cookie",
  "apiKey",
  "api_key",
  "token",
  "password",
];

describe("redactSensitive", () => {
  test("任意深度の機密フィールド値を censor する（大文字小文字無視）", () => {
    const obj = {
      headers: { authorization: "Bearer x", Cookie: "sid=abc" },
      data: { nested: { apiKey: "sk-xxx", token: "t-yyy" } },
      password: "p@ss",
      api_key: "ak-zzz",
    };

    const result = redactSensitive(obj, KEYS);

    expect(result.headers.authorization).toBe("[REDACTED]");
    expect(result.headers.Cookie).toBe("[REDACTED]");
    expect(result.data.nested.apiKey).toBe("[REDACTED]");
    expect(result.data.nested.token).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
  });

  test("非機密フィールドはそのまま保持する", () => {
    const obj = { message: "boom", url: "/api/x", count: 3 };
    const result = redactSensitive(obj, KEYS);
    expect(result).toEqual({ message: "boom", url: "/api/x", count: 3 });
  });

  test("配列内の機密フィールドも censor する", () => {
    const obj = { items: [{ token: "t1" }, { token: "t2" }] };
    const result = redactSensitive(obj, KEYS);
    expect(result.items).toEqual([
      { token: "[REDACTED]" },
      { token: "[REDACTED]" },
    ]);
  });

  test("循環参照を含んでも例外を投げない", () => {
    const obj: Record<string, unknown> = { token: "t" };
    obj.self = obj;
    expect(() => redactSensitive(obj, KEYS)).not.toThrow();
    expect((obj as { token: string }).token).toBe("[REDACTED]");
  });

  test("プリミティブ・null はそのまま返す", () => {
    expect(redactSensitive(null, KEYS)).toBeNull();
    expect(redactSensitive("x", KEYS)).toBe("x");
    expect(redactSensitive(42, KEYS)).toBe(42);
  });
});
