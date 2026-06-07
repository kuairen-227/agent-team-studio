/**
 * `setupSentry` の DSN ゲートの単体テスト。
 *
 * `SENTRY_DSN` 未設定時は Sentry を有効化せず（送信無効）false を返すこと、
 * 設定時は true を返すことを固定する（ADR-0035: DSN 未設定で送信無効化）。
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "./logger.ts";
import { setupSentry } from "./sentry.ts";

describe("setupSentry", () => {
  let savedDsn: string | undefined;

  beforeEach(() => {
    savedDsn = process.env.SENTRY_DSN;
  });

  afterEach(() => {
    if (savedDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = savedDsn;
    }
  });

  test("DSN 未設定なら有効化せず false を返す", () => {
    delete process.env.SENTRY_DSN;
    expect(setupSentry(new Hono<AppEnv>())).toBe(false);
  });

  test("DSN 設定時は true を返す", () => {
    // 実送信はしない形式上の DSN。init は同期で成功し true を返す。
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    expect(setupSentry(new Hono<AppEnv>())).toBe(true);
  });
});
