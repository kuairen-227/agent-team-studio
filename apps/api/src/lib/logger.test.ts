/**
 * `resolveLevel()` の単体テスト。
 *
 * `LOG_LEVEL` 明示指定が最優先・`NODE_ENV=test` で silent 既定という
 * 優先順位（設計意図）を自動検証する。process.env を直接書き換えるため
 * 各ケースで保存・復元する。
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolveLevel } from "./logger.ts";

describe("resolveLevel", () => {
  let savedLogLevel: string | undefined;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedLogLevel = process.env.LOG_LEVEL;
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    restoreEnv("LOG_LEVEL", savedLogLevel);
    restoreEnv("NODE_ENV", savedNodeEnv);
  });

  test("LOG_LEVEL 明示指定が最優先（test 環境でも上書きできる）", () => {
    process.env.LOG_LEVEL = "debug";
    process.env.NODE_ENV = "test";
    expect(resolveLevel()).toBe("debug");
  });

  test("LOG_LEVEL 未指定かつ NODE_ENV=test は silent", () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "test";
    expect(resolveLevel()).toBe("silent");
  });

  test("LOG_LEVEL 未指定かつ NODE_ENV!=test は info", () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "production";
    expect(resolveLevel()).toBe("info");
  });

  test("LOG_LEVEL・NODE_ENV 両方未設定なら info", () => {
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    expect(resolveLevel()).toBe("info");
  });

  test("LOG_LEVEL が空文字なら未指定扱い（NODE_ENV フォールバック）", () => {
    process.env.LOG_LEVEL = "";
    process.env.NODE_ENV = "test";
    expect(resolveLevel()).toBe("silent");
  });
});

/** 保存値が undefined なら削除、そうでなければ再設定する。 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
