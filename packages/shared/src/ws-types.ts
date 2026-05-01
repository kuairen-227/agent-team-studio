/**
 * WebSocket メッセージの型定義（サーバ → クライアント）。
 *
 * SSoT: docs/design/websocket-design.md
 * 命名規約は同 doc の JSON 例に合わせて camelCase。
 *
 * 設計 doc では `agent:status` の `reason?` を任意としていたが、
 * 型安全性のため `status: "failed"` を専用バリアント `AgentStatusFailedMessage` に
 * 分離して `reason` を必須にしている（websocket-design.md §メッセージ型 末尾の方針）。
 */

import type {
  AgentFailReason,
  ExecutionFailReason,
  ExecutionId,
  ResultId,
} from "./domain-types.ts";

// ---------- agent:status ----------

type AgentStatusBase = {
  type: "agent:status";
  agentId: string;
  /** ISO 8601。発火時刻（agent_started / agent_completed / agent_failed）を集約。 */
  timestamp: string;
};

/**
 * 初期スナップショット時のみ送信される（websocket-design.md §接続ライフサイクル）。
 * 対応する AgentEvent は存在しない。
 */
export type AgentStatusPendingMessage = AgentStatusBase & {
  status: "pending";
};

export type AgentStatusRunningMessage = AgentStatusBase & {
  status: "running";
};

export type AgentStatusCompletedMessage = AgentStatusBase & {
  status: "completed";
};

export type AgentStatusFailedMessage = AgentStatusBase & {
  status: "failed";
  reason: AgentFailReason;
};

export type AgentStatusMessage =
  | AgentStatusPendingMessage
  | AgentStatusRunningMessage
  | AgentStatusCompletedMessage
  | AgentStatusFailedMessage;

// ---------- agent:output ----------

export type AgentOutputMessage = {
  type: "agent:output";
  agentId: string;
  chunk: string;
};

// ---------- execution:completed / execution:failed ----------

export type ExecutionCompletedMessage = {
  type: "execution:completed";
  executionId: ExecutionId;
  resultId: ResultId;
};

export type ExecutionFailedMessage = {
  type: "execution:failed";
  executionId: ExecutionId;
  reason: ExecutionFailReason;
};

// ---------- WS メッセージ全体 ----------

export type WsMessage =
  | AgentStatusMessage
  | AgentOutputMessage
  | ExecutionCompletedMessage
  | ExecutionFailedMessage;

/** WS メッセージの種別文字列（websocket-design.md §メッセージ型 の `type` フィールド）。 */
export type WsMessageType = WsMessage["type"];
