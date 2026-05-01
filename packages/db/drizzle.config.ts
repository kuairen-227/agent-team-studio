/**
 * drizzle-kit 設定。
 *
 * - schema: src/schema/ 配下のすべてのテーブル定義を集約
 * - migration 出力先: drizzle/migrations
 * - DATABASE_URL は env から読み取る（compose が app コンテナに注入する前提。ADR-0018）
 *
 * 実行コマンド:
 * - bun run db:generate  ... schema 差分から SQL を生成
 * - bun run db:migrate   ... 生成済み SQL を DB に適用
 */

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  // 命名規約: snake_case（packages/db/README.md SSoT）
  casing: "snake_case",
  // 開発中は厳密モード（migration を未生成のまま push しない）
  strict: true,
  verbose: true,
});
