/**
 * `redact.ts` の単体テスト。
 *
 * Pino redact paths の導出（既存設定との回帰固定）と、Sentry beforeSend redactor が
 * 機密フィールドを除去すること（委譲スモーク）を確認する。再帰 redaction の詳細挙動は
 * `@agent-team-studio/shared` の redact.test.ts でカバーする。
 */

import { describe, expect, test } from "bun:test";
import { pinoRedactPaths, redactEvent } from "./redact.ts";

describe("pinoRedactPaths", () => {
  test("既存の Pino redact 設定と同一のパスを導出する", () => {
    // logger.ts が依存していた従来の固定パス（回帰防止のため明示的に固定）。
    expect(pinoRedactPaths).toEqual([
      "req.headers.authorization",
      "req.headers.cookie",
      "apiKey",
      "*.apiKey",
      "api_key",
      "*.api_key",
      "token",
      "*.token",
      "password",
      "*.password",
    ]);
  });
});

describe("redactEvent", () => {
  test("ネストした機密フィールドを censor し、非機密は保持する", () => {
    const event = {
      message: "boom",
      request: {
        url: "/api/templates",
        headers: { authorization: "Bearer secret", cookie: "sid=abc" },
      },
      extra: { nested: { apiKey: "sk-xxx" }, executionId: "exec-1" },
    };

    const result = redactEvent(event) as typeof event;

    expect(result.request.headers.authorization).toBe("[REDACTED]");
    expect(result.request.headers.cookie).toBe("[REDACTED]");
    expect(result.extra.nested.apiKey).toBe("[REDACTED]");
    expect(result.message).toBe("boom");
    expect(result.request.url).toBe("/api/templates");
    expect(result.extra.executionId).toBe("exec-1");
  });
});
