/**
 * agent-core 内部の進捗イベント型定義。
 *
 * SSoT: docs/design/agent-execution.md §5（実装後は本ファイルが SSoT）
 * engine が発行し、apps/api がコールバック経由で受け取って WsMessage に写像する。
 */

import type {
  AgentFailReason,
  ExecutionFailReason,
} from "@agent-team-studio/shared";

/** engine → apps/api への進捗通知イベント。discriminated union で `kind` により識別する。 */
export type AgentEvent =
  | { kind: "agent_started"; agentId: string; startedAt: string }
  | { kind: "agent_output_chunk"; agentId: string; chunk: string }
  | { kind: "agent_completed"; agentId: string; completedAt: string }
  | {
      kind: "agent_failed";
      agentId: string;
      reason: AgentFailReason;
      failedAt: string;
    }
  | { kind: "execution_completed"; resultId: string }
  | { kind: "execution_failed"; reason: ExecutionFailReason };
