/**
 * `reportQueryError` の単体テスト。
 *
 * 想定内のクライアントエラー（4xx）は Sentry に送らず、想定外（5xx・ネットワーク等）は
 * 送る、という契約を固定する（observability ノイズと free tier 枠の節約 / ADR-0035）。
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test";
import * as Sentry from "@sentry/react";
import { initSentry, reportQueryError } from "./sentry";

describe("initSentry", () => {
  let initSpy: Mock<typeof Sentry.init>;

  beforeEach(() => {
    initSpy = spyOn(Sentry, "init").mockImplementation(() => undefined);
  });

  afterEach(() => {
    initSpy.mockRestore();
  });

  test("DSN 未設定（空文字）なら初期化しない", () => {
    initSentry("");
    expect(initSpy).not.toHaveBeenCalled();
  });

  test("DSN 指定時は初期化する", () => {
    initSentry("https://examplePublicKey@o0.ingest.sentry.io/0");
    expect(initSpy).toHaveBeenCalledTimes(1);
  });
});

describe("reportQueryError", () => {
  let captureSpy: Mock<typeof Sentry.captureException>;

  beforeEach(() => {
    captureSpy = spyOn(Sentry, "captureException").mockImplementation(() => "");
  });

  afterEach(() => {
    captureSpy.mockRestore();
  });

  test("4xx（status=404）は送信しない", () => {
    reportQueryError(new Error("status=404"));
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test("5xx（status=500）は送信する", () => {
    const error = new Error("status=500");
    reportQueryError(error);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(error);
  });

  test("ネットワークエラー（TypeError）は送信する", () => {
    reportQueryError(new TypeError("Failed to fetch"));
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });

  test("不正 JSON（SyntaxError）は送信する", () => {
    reportQueryError(new SyntaxError("Unexpected token"));
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });

  test("非 Error 値（null・文字列）も想定外として送信する", () => {
    reportQueryError(null);
    reportQueryError("boom");
    expect(captureSpy).toHaveBeenCalledTimes(2);
  });
});
