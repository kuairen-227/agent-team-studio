/**
 * 初期データ投入スクリプト。
 *
 * `bun run db:seed` の実体。MVP では競合調査テンプレート 1 件のみを投入する。
 *
 * 冪等性: name を一意キーとして既存チェック。再実行しても重複しない。
 *  - DB レベルの UNIQUE 制約は付けない（MVP は seed 1 件のみで運用上必要なし）
 *  - 将来テンプレートが増えたら id を固定にして ON CONFLICT DO NOTHING に切替検討
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const db = drizzle(pool);

  const existing = await db
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.name, COMPETITOR_ANALYSIS_TEMPLATE_NAME));

  if (existing.length > 0) {
    console.log(
      `seed: template "${COMPETITOR_ANALYSIS_TEMPLATE_NAME}" already exists, skipping`,
    );
  } else {
    await db.insert(templates).values({
      name: COMPETITOR_ANALYSIS_TEMPLATE_NAME,
      description: competitorAnalysisDescription,
      definition: competitorAnalysisDefinition,
    });
    console.log(
      `seed: inserted template "${COMPETITOR_ANALYSIS_TEMPLATE_NAME}"`,
    );
  }
} finally {
  await pool.end();
}
