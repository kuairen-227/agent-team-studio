/**
 * `reportQueryError` の単体テスト。
 *
 * 想定内のクライアントエラー（4xx）は Sentry に送らず、想定外（5xx・ネットワーク等）は
 * 送る、という契約を固定する（observability ノイズと free tier 枠の節約 / ADR-0035）。
 */

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as Sentry from "@sentry/react";
import { reportQueryError } from "./sentry";

describe("reportQueryError", () => {
  const captureSpy = spyOn(Sentry, "captureException").mockImplementation(
    () => "",
  );

  afterEach(() => {
    captureSpy.mockClear();
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
});
