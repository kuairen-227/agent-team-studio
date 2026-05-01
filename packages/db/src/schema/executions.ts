/**
 * `executions` テーブル: テンプレートからの実行レコード。
 *
 * SSoT: docs/design/data-model.md §4.2, §5.2
 *
 * 物理スキーマの判断:
 * - status: text + CHECK 制約（PG enum 型は値削除/変更が困難なため、変動期に強い text+CHECK を採用）
 * - parameters: jsonb（テンプレート固有の入力。MVP は CompetitorAnalysisParameters のみ）
 * - template への FK は ON DELETE RESTRICT（テンプレート消失で過去実行が宙吊りにならないよう保護）
 */

import type { CompetitorAnalysisParameters } from "@agent-team-studio/shared";
import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { templates } from "./templates.ts";

export const EXECUTION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const executions = pgTable(
  "executions",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "restrict" }),
    parameters: jsonb("parameters")
      .$type<CompetitorAnalysisParameters>()
      .notNull(),
    status: text("status", { enum: EXECUTION_STATUSES }).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "executions_status_check",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
    ),
  ],
);

export type ExecutionRow = typeof executions.$inferSelect;
export type NewExecutionRow = typeof executions.$inferInsert;
