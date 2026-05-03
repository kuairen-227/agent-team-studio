/**
 * `templates` テーブルの読み出し repo。
 *
 * MVP は一覧（`TemplateSummary`）のみ。詳細取得（`definition` を含む）は
 * GET /api/templates/:id 実装時（US-2）に追加する。
 *
 * 戻り値の `id` は schema 側で uuid 型のため string にキャストせず、
 * `TemplateSummary` の `TemplateId = string` と互換になる。
 */

import type { TemplateSummary } from "@agent-team-studio/shared";
import { asc } from "drizzle-orm";
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
