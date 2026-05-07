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

/** エージェント実行開始時に送信される `agent:status` メッセージ。 */
export type AgentStatusRunningMessage = AgentStatusBase &
  WithEventTimestamp & {
    status: "running";
  };

/** エージェント正常完了時に送信される `agent:status` メッセージ。 */
export type AgentStatusCompletedMessage = AgentStatusBase &
  WithEventTimestamp & {
    status: "completed";
  };

/** エージェント失敗時に送信される `agent:status` メッセージ（`reason` 必須）。 */
export type AgentStatusFailedMessage = AgentStatusBase &
  WithEventTimestamp & {
    status: "failed";
    reason: AgentFailReason;
  };

/** `agent:status` メッセージ全バリアントの discriminated union。 */
export type AgentStatusMessage =
  | AgentStatusPendingMessage
  | AgentStatusRunningMessage
  | AgentStatusCompletedMessage
  | AgentStatusFailedMessage;

// ---------- agent:output ----------

/** エージェントの LLM 出力チャンクを転送する `agent:output` メッセージ。 */
export type AgentOutputMessage = {
  type: "agent:output";
  agentId: string;
  chunk: string;
};

// ---------- execution:completed / execution:failed ----------

/** Execution 正常完了時に送信される `execution:completed` メッセージ。 */
export type ExecutionCompletedMessage = {
  type: "execution:completed";
  executionId: ExecutionId;
  resultId: ResultId;
};

/** Execution 失敗時に送信される `execution:failed` メッセージ。 */
export type ExecutionFailedMessage = {
  type: "execution:failed";
  executionId: ExecutionId;
  reason: ExecutionFailReason;
};

// ---------- WS メッセージ全体 ----------

/** サーバ → クライアントの全 WS メッセージの discriminated union（websocket-design.md §メッセージ型）。 */
export type WsMessage =
  | AgentStatusMessage
  | AgentOutputMessage
  | ExecutionCompletedMessage
  | ExecutionFailedMessage;

/** WS メッセージの種別文字列（websocket-design.md §メッセージ型 の `type` フィールド）。 */
export type WsMessageType = WsMessage["type"];
