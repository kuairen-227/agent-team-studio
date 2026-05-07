/**
 * Execution 1 件と AgentExecution × N を同一トランザクションで INSERT する。
 * 両者を同一 commit で確定させることで、外部観測者が「Execution あり / AgentExecution 0 件」
 * の中間状態を見ないことを保証する。
 */

import type {
  AgentRole,
  CompetitorAnalysisParameters,
  CreateExecutionResponse,
  ExecutionStatus,
  TemplateId,
} from "@agent-team-studio/shared";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../client.ts";
import { agentExecutions, executions } from "../schema/index.ts";

/**
 * 呼び出し元（apps/api の service 層）で Zod による検証・正規化（trim 等）が
 * 完了している前提で受け取る。repo 層では再検証しない。
 */
export type CreateExecutionInput = {
  templateId: TemplateId;
  parameters: CompetitorAnalysisParameters;
  agents: { agentId: string; role: AgentRole }[];
};

export async function createExecution(
  db: DrizzleDb,
  input: CreateExecutionInput,
): Promise<CreateExecutionResponse> {
  return db.transaction(async (tx) => {
    const [execution] = await tx
      .insert(executions)
      .values({
        templateId: input.templateId,
        parameters: input.parameters,
        status: "pending",
      })
      .returning({
        id: executions.id,
        status: executions.status,
        createdAt: executions.createdAt,
      });

    if (!execution) {
      throw new Error("failed to insert execution");
    }

    await tx.insert(agentExecutions).values(
      input.agents.map((a) => ({
        executionId: execution.id,
        agentId: a.agentId,
        role: a.role,
        status: "pending" as const,
      })),
    );

    return {
      id: execution.id,
      status: execution.status,
      createdAt: execution.createdAt.toISOString(),
    };
  });
}

/** `executions` テーブルの可変フィールドのパッチ型。 */
export type ExecutionUpdatePatch = {
  status: ExecutionStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

/**
 * Execution のステータスを更新する。
 *
 * エンジンから呼び出される副作用。「DB UPDATE → イベント発行」の順序を保証するため、
 * 呼び出し元（engine）は本関数の完了を待ってからイベントを発行すること。
 */
export async function updateExecution(
  db: DrizzleDb,
  id: string,
  patch: ExecutionUpdatePatch,
): Promise<void> {
  await db
    .update(executions)
    .set({
      status: patch.status,
      ...(patch.errorMessage !== undefined && {
        errorMessage: patch.errorMessage,
      }),
      ...(patch.startedAt !== undefined && { startedAt: patch.startedAt }),
      ...(patch.completedAt !== undefined && {
        completedAt: patch.completedAt,
      }),
    })
    .where(eq(executions.id, id));
}
