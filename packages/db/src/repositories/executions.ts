/**
 * `executions` / `agent_executions` テーブルへの書き込み repo。
 *
 * `createExecution` は Execution 1 件と AgentExecution × N をトランザクションで INSERT する。
 * agent-execution.md §4 副作用順序（Execution INSERT → AgentExecution INSERT）を守る。
 * 途中失敗時は両方ロールバックされる。両者は同一 commit で確定するため、
 * WS 初期スナップショット等の外部観測者は「Execution あり / AgentExecution 0 件」の
 * 中間状態を観測しない（agent-execution.md §4 / websocket-design.md §接続ライフサイクル）。
 *
 * 戻り値は API レスポンス（CreateExecutionResponse）に必要な最小フィールドに限定する。
 */

import type {
  AgentRole,
  CompetitorAnalysisParameters,
  ExecutionId,
  ExecutionStatus,
  TemplateId,
} from "@agent-team-studio/shared";
import type { DrizzleDb } from "../client.ts";
import { agentExecutions, executions } from "../schema/index.ts";

export type CreateExecutionInput = {
  templateId: TemplateId;
  parameters: CompetitorAnalysisParameters;
  agents: { agentId: string; role: AgentRole }[];
};

export type CreateExecutionResult = {
  id: ExecutionId;
  status: ExecutionStatus;
  createdAt: string;
};

export async function createExecution(
  db: DrizzleDb,
  input: CreateExecutionInput,
): Promise<CreateExecutionResult> {
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
