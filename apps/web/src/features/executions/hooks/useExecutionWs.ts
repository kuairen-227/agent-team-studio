/**
 * Execution の WebSocket 接続を管理するフック。
 *
 * websocket-design.md §接続ライフサイクル に従い:
 * - 接続確立後に WsMessage を受信して状態を更新する
 * - execution:completed / execution:failed / close(1000) で接続終了
 * - close(4404) / close(1011) は接続エラーとして扱う
 * - React StrictMode の二重実行はクリーンアップ関数で対処する
 *
 * SSoT: packages/shared/src/ws-guards.ts（型ガード）
 */

import {
  type AgentStatus,
  type ExecutionFailReason,
  isAgentOutputMessage,
  isAgentStatusMessage,
  isExecutionCompletedMessage,
  isExecutionFailedMessage,
  type WsMessage,
} from "@agent-team-studio/shared";
import { useEffect, useReducer } from "react";

/** 各エージェントの表示状態。 */
export type AgentState = {
  agentId: string;
  status: AgentStatus;
  output: string;
  failReason?: string;
};

type WsState =
  | { phase: "connecting" }
  | { phase: "running"; agents: Map<string, AgentState> }
  | { phase: "completed"; resultId: string; agents: Map<string, AgentState> }
  | {
      phase: "failed";
      reason: ExecutionFailReason;
      agents: Map<string, AgentState>;
    }
  | { phase: "error"; code: number; agents: Map<string, AgentState> };

type Action =
  | { type: "message"; msg: WsMessage }
  | { type: "connected" }
  | { type: "ws_error"; code: number };

export function reducer(state: WsState, action: Action): WsState {
  switch (action.type) {
    case "connected":
      return { phase: "running", agents: new Map() };

    case "ws_error": {
      const agents =
        state.phase !== "connecting"
          ? state.agents
          : new Map<string, AgentState>();
      return { phase: "error", code: action.code, agents };
    }

    case "message": {
      const agents =
        state.phase !== "connecting"
          ? state.agents
          : new Map<string, AgentState>();
      const msg = action.msg;

      if (isAgentStatusMessage(msg)) {
        // 終端フェーズ後に届いた遅延メッセージは無視して逆行を防ぐ。
        if (state.phase === "completed" || state.phase === "failed")
          return state;
        const prev = agents.get(msg.agentId);
        const next: AgentState = {
          agentId: msg.agentId,
          status: msg.status,
          output: prev?.output ?? "",
          failReason: msg.status === "failed" ? msg.reason : prev?.failReason,
        };
        const newAgents = new Map(agents);
        newAgents.set(msg.agentId, next);
        return { ...state, phase: "running", agents: newAgents } as WsState;
      }

      if (isAgentOutputMessage(msg)) {
        // 終端フェーズ後に届いた遅延メッセージは無視して逆行を防ぐ。
        if (state.phase === "completed" || state.phase === "failed")
          return state;
        const prev = agents.get(msg.agentId);
        const next: AgentState = {
          agentId: msg.agentId,
          status: prev?.status ?? "running",
          output: (prev?.output ?? "") + msg.chunk,
          failReason: prev?.failReason,
        };
        const newAgents = new Map(agents);
        newAgents.set(msg.agentId, next);
        return { ...state, phase: "running", agents: newAgents } as WsState;
      }

      if (isExecutionCompletedMessage(msg)) {
        return {
          phase: "completed",
          resultId: msg.resultId,
          agents,
        };
      }

      if (isExecutionFailedMessage(msg)) {
        return {
          phase: "failed",
          reason: msg.reason,
          agents,
        };
      }

      return state;
    }
  }
}

const INITIAL_STATE: WsState = { phase: "connecting" };

export function useExecutionWs(executionId: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?executionId=${encodeURIComponent(executionId)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      dispatch({ type: "connected" });
    };

    ws.onmessage = (event) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }
      dispatch({ type: "message", msg });
    };

    // onerror と onclose は通常セット発火（onerror → onclose）する。
    // 二重 dispatch を防ぐため onerror で dispatch 済みのときは onclose をスキップする。
    let errorDispatched = false;

    ws.onclose = (event) => {
      // close code 1000 は正常終了（execution:completed/failed 受信後）。
      // それ以外（4404 / 1011 等）は接続エラーとして扱う。
      if (event.code !== 1000 && !errorDispatched) {
        dispatch({ type: "ws_error", code: event.code });
      }
    };

    ws.onerror = () => {
      errorDispatched = true;
      dispatch({ type: "ws_error", code: 0 });
    };

    return () => {
      ws.close();
    };
  }, [executionId]);

  return state;
}
