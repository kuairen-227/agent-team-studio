/**
 * schema 内部ヘルパ。`schema/index.ts` の barrel re-export には含めない
 * （`_` プレフィックスはパッケージ内部限定の意図を示す）。
 */

import { type SQL, sql } from "drizzle-orm";

/**
 * CHECK 制約用に `('a', 'b', 'c')` の SQL 断片を生成する。
 *
 * 値は `as const` 配列の静的定数（shared の `EXECUTION_STATUSES` 等）を想定するため、
 * `sql.raw` でリテラル展開して問題ない（SQL インジェクション経路なし）。
 * これにより CHECK の SQL リテラルと TS 側の値配列が同じ SSoT から導出される。
 */
export function sqlLiteralList(values: readonly string[]): SQL {
  return sql.raw(values.map((v) => `'${v}'`).join(", "));
}
