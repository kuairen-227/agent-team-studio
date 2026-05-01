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

// `@agent-team-studio/shared` の `ExecutionStatus` 型 と
// `agent-executions.ts` の `AGENT_STATUSES` と値が重複している。
// 一元化（shared に as const 配列を置いて両者から import）は別 Issue で扱う。
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
    // 状態遷移の整合性を DB レベルで防衛する。
    // started_at なしで completed_at が立つ／completed_at が started_at より過去、
    // のいずれも論理的にあり得ないため CHECK で弾く（直接 SQL 操作・バグ対策）。
    check(
      "executions_completed_requires_started_check",
      sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NOT NULL`,
    ),
    check(
      "executions_completed_after_started_check",
      sql`${table.startedAt} IS NULL OR ${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`,
    ),
  ],
);

export type ExecutionRow = typeof executions.$inferSelect;
export type NewExecutionRow = typeof executions.$inferInsert;
