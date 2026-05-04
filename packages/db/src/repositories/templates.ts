/**
 * `templates` テーブルの読み出し repo。
 *
 * - `listTemplateSummaries`: 一覧（`TemplateSummary`）。`definition` を含めない軽量表現
 * - `getTemplateById`: 詳細（`Template`）。`definition` と timestamps を含む
 *
 * Drizzle の column 名は camelCase（schema 定義と一致）だが、ドメイン型 `Template`
 * は data-model.md §6 に従い snake_case。境界で明示的にマッピングする。
 */

import type { Template, TemplateSummary } from "@agent-team-studio/shared";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../client.ts";
import { templates } from "../schema/index.ts";

export async function listTemplateSummaries(
  db: DrizzleDb,
): Promise<TemplateSummary[]> {
  return db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
    })
    .from(templates)
    .orderBy(asc(templates.createdAt));
}

export async function getTemplateById(
  db: DrizzleDb,
  id: string,
): Promise<Template | null> {
  const rows = await db.select().from(templates).where(eq(templates.id, id));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    definition: row.definition,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
