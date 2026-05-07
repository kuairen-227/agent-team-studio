/**
 * AgentExecution の更新リポジトリ。
 *
 * エンジンから「DB UPDATE → イベント発行」の順序で呼び出される。
 * 呼び出し元はこの関数の完了を待ってからイベントを発行すること。
 */

import type {
  AgentStatus,
  IntegrationAgentOutput,
  InvestigationAgentOutput,
} from "@agent-team-studio/shared";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../client.ts";
import { agentExecutions } from "../schema/index.ts";

/** `agent_executions` テーブルの可変フィールドのパッチ型。 */
export type AgentExecutionUpdatePatch = {
  status: AgentStatus;
  output?: InvestigationAgentOutput | IntegrationAgentOutput;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

/** AgentExecution のステータス・出力を更新する。 */
export async function updateAgentExecution(
  db: DrizzleDb,
  id: string,
  patch: AgentExecutionUpdatePatch,
): Promise<void> {
  await db
    .update(agentExecutions)
    .set({
      status: patch.status,
      ...(patch.output !== undefined && { output: patch.output }),
      ...(patch.errorMessage !== undefined && {
        errorMessage: patch.errorMessage,
      }),
      ...(patch.startedAt !== undefined && { startedAt: patch.startedAt }),
      ...(patch.completedAt !== undefined && {
        completedAt: patch.completedAt,
      }),
    })
    .where(eq(agentExecutions.id, id));
}
