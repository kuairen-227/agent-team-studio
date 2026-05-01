/**
 * WebSocket メッセージの型ガード関数。
 *
 * `WsMessage` discriminated union から特定バリアントへナローイングするための
 * 最小限のヘルパー。本ファイルは runtime コードを含むため ws-types.ts とは分離する。
 */

import type {
  AgentOutputMessage,
  AgentStatusFailedMessage,
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

export function isAgentStatusFailed(
  msg: WsMessage,
): msg is AgentStatusFailedMessage {
  return msg.type === "agent:status" && msg.status === "failed";
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
