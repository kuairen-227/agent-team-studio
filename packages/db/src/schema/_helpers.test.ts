import { describe, expect, test } from "bun:test";
import {
  AGENT_ROLES,
  AGENT_STATUSES,
  EXECUTION_STATUSES,
} from "@agent-team-studio/shared";
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

  // shared 側の値が CHECK 制約 SQL に直接反映されることを保証する結合テスト。
  // shared の値変更（例: ADR-0014 の partial_failure 追加）が migration へ
  // 期待どおり伝播するかをここで検知する。
  test("shared の SSoT 配列を渡すと現行 CHECK 制約と一致する SQL を生成する", () => {
    expect(dialect.sqlToQuery(sqlLiteralList(EXECUTION_STATUSES)).sql).toBe(
      "'pending', 'running', 'completed', 'failed'",
    );
    expect(dialect.sqlToQuery(sqlLiteralList(AGENT_STATUSES)).sql).toBe(
      "'pending', 'running', 'completed', 'failed'",
    );
    expect(dialect.sqlToQuery(sqlLiteralList(AGENT_ROLES)).sql).toBe(
      "'investigation', 'integration'",
    );
  });
});
