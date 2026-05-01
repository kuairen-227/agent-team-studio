/**
 * Drizzle DB クライアントのファクトリ。
 *
 * - drizzle-orm/node-postgres + pg を使う（drizzle driver は pg で確定）
 * - DATABASE_URL は呼び出し側（apps/api / scripts）で env から取り出して渡す
 *   → packages/db は env を直接読まない（テスト容易性・依存方向の単純化）
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.ts";

export type DbClient = ReturnType<typeof createDbClient>;

export function createDbClient(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}
