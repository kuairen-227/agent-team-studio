import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sqlLiteralList } from "./_helpers.ts";

const dialect = new PgDialect();

describe("sqlLiteralList", () => {
  test("as const 配列をシングルクォート区切りの SQL リテラル列に展開する", () => {
    const result = sqlLiteralList([
      "pending",
      "running",
      "completed",
      "failed",
    ]);
    expect(dialect.sqlToQuery(result).sql).toBe(
      "'pending', 'running', 'completed', 'failed'",
    );
  });

  test("単一要素でも正しく展開される", () => {
    const result = sqlLiteralList(["investigation"]);
    expect(dialect.sqlToQuery(result).sql).toBe("'investigation'");
  });

  test("値はパラメータ化されず raw リテラルとして埋め込まれる（CHECK 制約 DDL での使用が前提）", () => {
    const result = sqlLiteralList(["a", "b"]);
    expect(dialect.sqlToQuery(result).params).toEqual([]);
  });
});
