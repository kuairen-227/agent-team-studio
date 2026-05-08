/**
 * WebSocket メッセージの型ガード関数。
 *
 * `WsMessage` discriminated union から特定バリアントへナローイングするための
 * 最小限のヘルパー。本ファイルは runtime コードを含むため ws-types.ts とは分離する。
 *
 * 受信した生データ（unknown）を `WsMessage` にする parse / 検証は WS ハンドラ層
 * （apps/api 側）の責務とし、本ファイルは parse 済みの `WsMessage` に対する
 * バリアント識別のみを担う。Zod 等のスキーマ検証はコンシューマー側で行う。
 */

import type {
  AgentOutputMessage,
  AgentStatusMessage,
  ExecutionCompletedMessage,
  ExecutionFailedMessage,
  WsMessage,
} from "./ws-types.ts";

export function isAgentStatusMessage(
  msg: WsMessage,
): msg is AgentStatusMessage {
  return msg.type === "agent:status";
}

export function isAgentOutputMessage(
  msg: WsMessage,
): msg is AgentOutputMessage {
  return msg.type === "agent:output";
}

export function isExecutionCompletedMessage(
  msg: WsMessage,
): msg is ExecutionCompletedMessage {
  return msg.type === "execution:completed";
}

export function isExecutionFailedMessage(
  msg: WsMessage,
): msg is ExecutionFailedMessage {
  return msg.type === "execution:failed";
}
