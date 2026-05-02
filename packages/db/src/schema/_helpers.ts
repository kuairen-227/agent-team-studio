/**
 * schema 内部ヘルパ。`schema/index.ts` の barrel re-export には含めない
 * （`_` プレフィックスはパッケージ内部限定の意図を示す）。
 */

import { type SQL, sql } from "drizzle-orm";

/**
 * CHECK 制約用に `'a', 'b', 'c'` の SQL 断片を生成する（呼び出し側の `IN (...)` 内に埋め込む想定）。
 *
 * `sql.raw` でリテラル展開するため、引数は **コンパイル時に値が確定する `as const` 配列**
 * （shared の `EXECUTION_STATUSES` 等）に限定する。動的文字列・ユーザー入力を渡すと
 * SQL インジェクション経路になる。
 *
 * 型 `readonly [string, ...string[]]`（非空タプル）により以下を強制する:
 * - `as const` 配列はタプル型として推論されるため代入可
 * - `arr.map()` 等の動的配列は `string[]` 型のため代入不可（`as` キャストでのみ通る）
 * - 空配列は最低 1 要素制約により代入不可（`IN ()` の不正 SQL を防止）
 */
export function sqlLiteralList(values: readonly [string, ...string[]]): SQL {
  return sql.raw(values.map((v) => `'${v}'`).join(", "));
}
