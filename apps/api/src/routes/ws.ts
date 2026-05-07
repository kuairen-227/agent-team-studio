/**
 * `/ws?executionId=<id>` WebSocket ルート。
 *
 * 接続ライフサイクル（バリデーション → 初期スナップショット → イベント転送 → close）は
 * websocket-design.md §接続ライフサイクル に準拠する。
 *
 * AgentEvent → WsMessage の写像は websocket-design.md §AgentEvent → WsMessage 写像 に従う。
 */

import type { AgentEvent } from "@agent-team-studio/agent-core";
import type {
  AgentExecutionDetail,
  AgentFailReason,
  AgentStatusMessage,
  ExecutionFailReason,
  WsMessage,
} from "@agent-team-studio/shared";
import { Hono } from "hono";
import { upgradeWebSocket } from "../lib/ws.ts";
import type { ExecutionsService } from "../services/executions.ts";

const EXECUTION_ID_RE = /^[a-z0-9-]{1,64}$/;

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

          // 1. executionId の形式バリデーション
          if (!EXECUTION_ID_RE.test(executionId)) {
            ws.close(4404, "execution_not_found");
            return;
          }

          // 2. Execution の存在確認と詳細取得
          const detail = await deps.executionsService.getExecution(executionId);
          if (!detail) {
            ws.close(4404, "execution_not_found");
            return;
          }

          // 3. 初期スナップショット: 各 AgentExecution の現状態を送信
          for (const ae of detail.agentExecutions) {
            send(agentExecutionToStatusMessage(ae));
          }

          // 4. 完了済み Execution: 終端メッセージを送信して close
          if (detail.status === "completed" && detail.result) {
            send({
              type: "execution:completed",
              executionId: detail.id,
              resultId: detail.result.id,
            });
            ws.close(1000, "normal");
            return;
          }

          if (detail.status === "failed") {
            send({
              type: "execution:failed",
              executionId: detail.id,
              reason: (detail.errorMessage ??
                "internal_error") as ExecutionFailReason,
            });
            ws.close(1000, "normal");
            return;
          }

          // 5. 進行中 (pending / running): AgentEvent を購読して転送
          unsubscribe = deps.subscribeToExecution(
            executionId,
            (event: AgentEvent) => {
              const msg = agentEventToWsMessage(event, executionId);
              if (msg) send(msg);

              // execution:completed / execution:failed を受信したら close
              if (
                event.kind === "execution_completed" ||
                event.kind === "execution_failed"
              ) {
                ws.close(1000, "normal");
              }
            },
          );
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
        reason: (ae.errorMessage ?? "internal_error") as AgentFailReason,
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
