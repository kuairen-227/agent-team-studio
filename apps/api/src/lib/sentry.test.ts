/**
 * `setupSentry` / `tagRequestId` / `shouldHandleError` の単体テスト。
 *
 * `SENTRY_DSN` 未設定時は Sentry を有効化せず（送信無効）false を返すこと、
 * 設定時は true を返すこと、未初期化でも `tagRequestId` が例外を投げないこと、
 * `shouldHandleError` が業務エラー（NotFoundError/ValidationError）を送らず内部例外のみ
 * 送ることを固定する（ADR-0035: DSN 未設定で送信無効化・DSN なしで起動可能・業務エラー非送信）。
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { close, getClient } from "@sentry/hono/bun";
import { Hono } from "hono";
import { NotFoundError, onError, ValidationError } from "./errors.ts";
import type { AppEnv } from "./logger.ts";
import { setupSentry, shouldHandleError, tagRequestId } from "./sentry.ts";

const VALID_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

// SENTRY_DSN は実 env から書き換えるため、各テストで保存・復元し、
// init 済みクライアントのグローバル状態も解除して後続テストへ副作用を残さない。
describe("sentry", () => {
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
    // init 有無にかかわらず安全に呼べる（未 init 時は no-op）。
    await close(0);
  });

  describe("setupSentry", () => {
    test("DSN 未設定なら有効化せず false を返す", () => {
      delete process.env.SENTRY_DSN;
      expect(setupSentry(new Hono<AppEnv>())).toBe(false);
    });

    test("DSN 設定時は true を返す", () => {
      // 実送信はしない形式上の DSN。init は同期で成功し true を返す。
      process.env.SENTRY_DSN = VALID_DSN;
      expect(setupSentry(new Hono<AppEnv>())).toBe(true);
    });
  });

  // sentry() の戻り値ミドルウェアを app.use で登録し損ねると、init は成功し
  // setupSentry は true を返すのに HTTP リクエストの例外が一切捕捉されない。
  // 「内部例外は captureException される / 業務エラーはされない」を実リクエストで固定し、
  // ミドルウェア未登録・shouldHandleError の退化を回帰検知する。
  describe("error capture (middleware registration)", () => {
    // setupSentry 後の Sentry client の captureException を spy する。
    // この spy が呼ばれる＝戻り値ミドルウェアが app.use 経由で実行されている証跡。
    function buildAppAndSpy() {
      process.env.SENTRY_DSN = VALID_DSN;
      const app = new Hono<AppEnv>();
      setupSentry(app);
      app.onError(onError);
      app.get("/boom", () => {
        throw new Error("internal boom");
      });
      app.get("/missing", () => {
        throw new NotFoundError("template", "x");
      });
      app.post("/invalid", () => {
        throw new ValidationError([{ field: "name", reason: "required" }]);
      });

      const client = getClient();
      if (!client) throw new Error("Sentry client が初期化されていない");
      const spy = spyOn(client, "captureException").mockImplementation(
        () => "event-id",
      );
      return { app, spy };
    }

    test("内部例外(500)は captureException される", async () => {
      const { app, spy } = buildAppAndSpy();

      const res = await app.request("/boom");

      expect(res.status).toBe(500);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    });

    test("業務エラー(404/400)は captureException されない", async () => {
      const { app, spy } = buildAppAndSpy();

      const notFound = await app.request("/missing");
      const invalid = await app.request("/invalid", { method: "POST" });

      expect(notFound.status).toBe(404);
      expect(invalid.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("tagRequestId", () => {
    test("Sentry 未初期化でも例外を投げない（no-op）", () => {
      delete process.env.SENTRY_DSN;
      expect(() => tagRequestId("req-123")).not.toThrow();
    });

    test("Sentry 初期化済みでも例外を投げない", () => {
      process.env.SENTRY_DSN = VALID_DSN;
      setupSentry(new Hono<AppEnv>());
      expect(() => tagRequestId("req-456")).not.toThrow();
    });
  });
});

describe("shouldHandleError", () => {
  test("業務エラー（NotFoundError / ValidationError）は送らない", () => {
    expect(shouldHandleError(new NotFoundError("template", "t-1"))).toBe(false);
    expect(
      shouldHandleError(
        new ValidationError([{ field: "name", reason: "required" }]),
      ),
    ).toBe(false);
  });

  test("内部例外（その他の Error・非 Error）は送る", () => {
    expect(shouldHandleError(new Error("boom"))).toBe(true);
    expect(shouldHandleError(new TypeError("bad"))).toBe(true);
    expect(shouldHandleError("unexpected")).toBe(true);
  });
});
