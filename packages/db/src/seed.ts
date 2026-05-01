/**
 * 初期データ投入スクリプト。
 *
 * `bun run db:seed` の実体。MVP では競合調査テンプレート 1 件のみを投入する。
 *
 * 本ファイルは関数 `seedTemplates` を export する形にして、将来テストや別スクリプトで
 * 再利用できるようにする。CLI から直接呼ばれた場合のみ Pool を作って実行する。
 *
 * 冪等性: name を一意キーとして既存チェック。再実行しても重複しない。
 *  - DB レベルの UNIQUE 制約は付けない（MVP は seed 1 件のみで運用上必要なし）
 *  - SELECT → INSERT 間に TOCTOU の隙はあるが、seed は単一プロセス前提のため実害なし。
 *    将来 CI 並列化等で並行実行が発生する前に `ON CONFLICT DO NOTHING` 方式へ切替えること
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { templates } from "./schema/index.ts";
import {
  COMPETITOR_ANALYSIS_TEMPLATE_NAME,
  competitorAnalysisDefinition,
  competitorAnalysisDescription,
} from "./seed-data/competitor-analysis.ts";

type DrizzleDb = ReturnType<typeof drizzle>;

export async function seedTemplates(db: DrizzleDb): Promise<void> {
  const existing = await db
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.name, COMPETITOR_ANALYSIS_TEMPLATE_NAME));

  if (existing.length > 0) {
    console.log(
      `seed: template "${COMPETITOR_ANALYSIS_TEMPLATE_NAME}" already exists, skipping`,
    );
    return;
  }

  await db.insert(templates).values({
    name: COMPETITOR_ANALYSIS_TEMPLATE_NAME,
    description: competitorAnalysisDescription,
    definition: competitorAnalysisDefinition,
  });
  console.log(`seed: inserted template "${COMPETITOR_ANALYSIS_TEMPLATE_NAME}"`);
}

// CLI として直接実行された場合のみ Pool を起こす。
// テストや別スクリプトから `seedTemplates(db)` として呼ばれた場合は実行されない。
if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await seedTemplates(drizzle(pool));
  } finally {
    await pool.end();
  }
}
