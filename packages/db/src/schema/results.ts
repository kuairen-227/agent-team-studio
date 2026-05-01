/**
 * `results` テーブル: Execution の最終成果物（Integration Agent 完了時のみ生成）。
 *
 * SSoT: docs/design/data-model.md §4.4, §3 不変条件
 *
 * 物理スキーマの判断:
 * - structured: jsonb（CompetitorAnalysisResult。Integration Agent 出力と同型）
 *   data-model.md §10 で「フィールド名は物理スキーマ確定時に再検討」とあったが、
 *   論理モデルと同名 `structured` のまま採用（型名 CompetitorAnalysisResult との衝突は実害なし）
 * - UNIQUE (execution_id): Execution : Result = 1 : 0..1（data-model.md §2）を DB で施行
 * - 親 Execution への FK は ON DELETE CASCADE
 */

import type { CompetitorAnalysisResult } from "@agent-team-studio/shared";
import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { executions } from "./executions.ts";

export const results = pgTable(
  "results",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    markdown: text("markdown").notNull(),
    structured: jsonb("structured").$type<CompetitorAnalysisResult>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("results_execution_unique").on(table.executionId)],
);

export type ResultRow = typeof results.$inferSelect;
export type NewResultRow = typeof results.$inferInsert;
