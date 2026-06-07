/**
 * `setupSentry` / `tagRequestId` の単体テスト。
 *
 * `SENTRY_DSN` 未設定時は Sentry を有効化せず（送信無効）false を返すこと、
 * 設定時は true を返すこと、未初期化でも `tagRequestId` が例外を投げないことを固定する
 * （ADR-0035: DSN 未設定で送信無効化・DSN なしで起動可能）。
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { close } from "@sentry/hono/bun";
import { Hono } from "hono";
import type { AppEnv } from "./logger.ts";
import { setupSentry, tagRequestId } from "./sentry.ts";

describe("setupSentry", () => {
  let savedDsn: string | undefined;

  beforeEach(() => {
    savedDsn = process.env.SENTRY_DSN;
  });

  afterEach(async () => {
    if (savedDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = savedDsn;
    }
    // init 済みクライアントのグローバル状態を解除し、後続テストへ副作用を残さない。
    // init 有無にかかわらず安全に呼べる（未 init 時は no-op）。
    await close(0);
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

describe("tagRequestId", () => {
  let savedDsn: string | undefined;

  beforeEach(() => {
    savedDsn = process.env.SENTRY_DSN;
  });

  afterEach(async () => {
    if (savedDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = savedDsn;
    }
    await close(0);
  });

  test("Sentry 未初期化でも例外を投げない（no-op）", () => {
    delete process.env.SENTRY_DSN;
    expect(() => tagRequestId("req-123")).not.toThrow();
  });

  test("Sentry 初期化済みでも例外を投げない", () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    setupSentry(new Hono<AppEnv>());
    expect(() => tagRequestId("req-456")).not.toThrow();
  });
});
