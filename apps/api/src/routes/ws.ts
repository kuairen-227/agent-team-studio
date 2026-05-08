/**
 * `/ws?executionId=<id>` WebSocket ルート。
 *
 * 接続ライフサイクル（バリデーション → 初期スナップショット → イベント転送 → close）は
 * websocket-design.md §接続ライフサイクル に準拠する。
 *
 * AgentEvent → WsMessage の写像は websocket-design.md §AgentEvent → WsMessage 写像 に従う。
 */

import type { AgentEvent } from "@agent-team-studio/agent-core";
import {
  AGENT_FAIL_REASONS,
  type AgentExecutionDetail,
  type AgentFailReason,
  type AgentStatusMessage,
  EXECUTION_FAIL_REASONS,
  type ExecutionFailReason,
  type WsMessage,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { upgradeWebSocket } from "../lib/ws.ts";
import type { ExecutionsService } from "../services/executions.ts";

const EXECUTION_ID_RE = /^[a-z0-9-]{1,64}$/;

function isExecutionFailReason(v: unknown): v is ExecutionFailReason {
  return (EXECUTION_FAIL_REASONS as readonly unknown[]).includes(v);
}

function isAgentFailReason(v: unknown): v is AgentFailReason {
  return (AGENT_FAIL_REASONS as readonly unknown[]).includes(v);
}

export function createWsRoutes(deps: {
  executionsService: ExecutionsService;
  subscribeToExecution: (
    executionId: string,
    handler: (event: AgentEvent) => void,
  ) => () => void;
}) {
  const app = new Hono();

  app.get(
    "/",
    upgradeWebSocket((c) => {
      const executionId = c.req.query("executionId") ?? "";
      let unsubscribe: (() => void) | undefined;

      return {
        async onOpen(_event, ws) {
          const send = (msg: WsMessage) => {
            try {
              ws.send(JSON.stringify(msg));
            } catch {
              // WS が既に閉じている場合は無視する。
            }
          };

          try {
            // 形式が不正な executionId は DB 検索不要で弾く。
            if (!EXECUTION_ID_RE.test(executionId)) {
              ws.close(4404, "execution_not_found");
              return;
            }

            const detail =
              await deps.executionsService.getExecution(executionId);
            if (!detail) {
              ws.close(4404, "execution_not_found");
              return;
            }

            // 初期スナップショット: 各 AgentExecution の現状態を送信する。
            for (const ae of detail.agentExecutions) {
              send(agentExecutionToStatusMessage(ae));
            }

            // 完了済み Execution は subscribe が不要なため即 close する。
            if (detail.status === "completed") {
              if (!detail.result) {
                ws.close(1011, "server_error");
                return;
              }
              send({
                type: "execution:completed",
                executionId: detail.id,
                resultId: detail.result.id,
              });
              ws.close(1000, "normal");
              return;
            }

            // 失敗済み Execution も同様に即 close する。
            if (detail.status === "failed") {
              send({
                type: "execution:failed",
                executionId: detail.id,
                reason: isExecutionFailReason(detail.errorMessage)
                  ? detail.errorMessage
                  : "internal_error",
              });
              ws.close(1000, "normal");
              return;
            }

            // pending / running: AgentEvent を購読して転送する。
            unsubscribe = deps.subscribeToExecution(
              executionId,
              (event: AgentEvent) => {
                const msg = agentEventToWsMessage(event, executionId);
                if (msg) send(msg);

                // 終端イベント受信後は subscribe が不要になるため即解除する。
                if (
                  event.kind === "execution_completed" ||
                  event.kind === "execution_failed"
                ) {
                  ws.close(1000, "normal");
                  unsubscribe?.();
                  unsubscribe = undefined;
                }
              },
            );
          } catch {
            ws.close(1011, "server_error");
          }
        },

        onClose() {
          unsubscribe?.();
        },

        onError() {
          unsubscribe?.();
        },
      };
    }),
  );

  return app;
}

/** AgentExecution の現状態を対応する `agent:status` WsMessage に変換する。 */
function agentExecutionToStatusMessage(
  ae: AgentExecutionDetail,
): AgentStatusMessage {
  const base = { type: "agent:status" as const, agentId: ae.agentId };

  switch (ae.status) {
    case "pending":
      return { ...base, status: "pending" };
    case "running":
      return {
        ...base,
        status: "running",
        timestamp: ae.startedAt ?? new Date().toISOString(),
      };
    case "completed":
      return {
        ...base,
        status: "completed",
        timestamp: ae.completedAt ?? new Date().toISOString(),
      };
    case "failed":
      return {
        ...base,
        status: "failed",
        reason: isAgentFailReason(ae.errorMessage)
          ? ae.errorMessage
          : "internal_error",
        timestamp: ae.completedAt ?? new Date().toISOString(),
      };
  }
}

/** AgentEvent を対応する WsMessage に写像する（websocket-design.md §AgentEvent → WsMessage 写像）。 */
function agentEventToWsMessage(
  event: AgentEvent,
  executionId: string,
): WsMessage | null {
  switch (event.kind) {
    case "agent_started":
      return {
        type: "agent:status",
        agentId: event.agentId,
        status: "running",
        timestamp: event.startedAt,
      };
    case "agent_output_chunk":
      return {
        type: "agent:output",
        agentId: event.agentId,
        chunk: event.chunk,
      };
    case "agent_completed":
      return {
        type: "agent:status",
        agentId: event.agentId,
        status: "completed",
        timestamp: event.completedAt,
      };
    case "agent_failed":
      return {
        type: "agent:status",
        agentId: event.agentId,
        status: "failed",
        reason: event.reason,
        timestamp: event.failedAt,
      };
    case "execution_completed":
      return {
        type: "execution:completed",
        executionId,
        resultId: event.resultId,
      };
    case "execution_failed":
      return {
        type: "execution:failed",
        executionId,
        reason: event.reason,
      };
    default:
      return null;
  }
}
