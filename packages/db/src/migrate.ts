/**
 * migration 適用スクリプト。
 *
 * `bun run db:migrate` の実体。drizzle-kit generate で生成された SQL を
 * DATABASE_URL の DB に順番に適用する。
 *
 * - 専用接続を使い、終了後に Pool を必ず閉じる（プロセスがハングしない）
 * - 適用済み migration は drizzle 内部の `__drizzle_migrations` テーブルで管理される
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("migrations applied");
} finally {
  await pool.end();
}
