/**
 * Execution 1 件と AgentExecution × N を同一トランザクションで INSERT する。
 * 両者を同一 commit で確定させることで、外部観測者が「Execution あり / AgentExecution 0 件」
 * の中間状態を見ないことを保証する。
 */

import type {
  AgentRole,
  CompetitorAnalysisParameters,
  CreateExecutionResponse,
  TemplateId,
} from "@agent-team-studio/shared";
import type { DrizzleDb } from "../client.ts";
import { agentExecutions, executions } from "../schema/index.ts";

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
