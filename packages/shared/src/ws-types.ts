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
};

/**
 * timestamp 付きバリアント用の追加プロパティ。
 * websocket-design.md §AgentEvent → WsMessage 写像 に従い
 * agent_started / agent_completed / agent_failed の発火時刻を集約する。
 */
type WithEventTimestamp = {
  /** ISO 8601。 */
  timestamp: string;
};

/**
 * 初期スナップショット時のみ送信される（websocket-design.md §接続ライフサイクル）。
 * 対応する AgentEvent は存在せず、pending 時点では started_at が DB に未 INSERT のため
 * timestamp は持たない。
 */
export type AgentStatusPendingMessage = AgentStatusBase & {
  status: "pending";
};

export type AgentStatusRunningMessage = AgentStatusBase &
  WithEventTimestamp & {
    status: "running";
  };

export type AgentStatusCompletedMessage = AgentStatusBase &
  WithEventTimestamp & {
    status: "completed";
  };

export type AgentStatusFailedMessage = AgentStatusBase &
  WithEventTimestamp & {
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
