/**
 * `agent_executions` テーブル: Execution 内の個別エージェント実行。
 *
 * SSoT: docs/design/data-model.md §4.3, §5.1
 *
 * 物理スキーマの判断:
 * - role / status は text + CHECK
 * - output: jsonb（role により Investigation/Integration の discriminated union。
 *   DB レベルでの分岐検証は行わず、TS 側型で担保）
 * - UNIQUE (execution_id, agent_id): data-model.md §3 不変条件「同一 Execution 内で agent_id は一意」を DB で施行
 * - 親 Execution への FK は ON DELETE CASCADE（Execution 削除時に追従）
 */

import type {
  IntegrationAgentOutput,
  InvestigationAgentOutput,
} from "@agent-team-studio/shared";
import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { executions } from "./executions.ts";

export const AGENT_ROLES = ["investigation", "integration"] as const;

export const AGENT_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const agentExecutions = pgTable(
  "agent_executions",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    role: text("role", { enum: AGENT_ROLES }).notNull(),
    status: text("status", { enum: AGENT_STATUSES }).notNull(),
    output: jsonb("output").$type<
      InvestigationAgentOutput | IntegrationAgentOutput
    >(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("agent_executions_execution_agent_unique").on(
      table.executionId,
      table.agentId,
    ),
    check(
      "agent_executions_role_check",
      sql`${table.role} IN ('investigation', 'integration')`,
    ),
    check(
      "agent_executions_status_check",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
    ),
  ],
);

export type AgentExecutionRow = typeof agentExecutions.$inferSelect;
export type NewAgentExecutionRow = typeof agentExecutions.$inferInsert;
