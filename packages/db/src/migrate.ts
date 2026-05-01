/**
 * migration 適用スクリプト。
 *
 * `bun run db:migrate` の実体。drizzle-kit generate で生成された SQL を
 * DATABASE_URL の DB に順番に適用する。
 *
 * - 専用接続を使い、終了後に Pool を必ず閉じる（プロセスがハングしない）
 * - 適用済み migration は drizzle 内部の `__drizzle_migrations` テーブルで管理される
 * - CLI 実行時のみ副作用を発生させるため `import.meta.main` ガードで保護する
 *   （seed.ts と同じパターン。誤 import 時の意図しない migration 実行を防ぐ）
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // migrate には schema バインドが不要なため createDbClient を経由せず Pool を直接使う
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}
