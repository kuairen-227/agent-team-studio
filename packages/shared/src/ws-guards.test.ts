import { describe, expect, test } from "bun:test";
import {
  isAgentOutputMessage,
  isAgentStatusMessage,
  isExecutionCompletedMessage,
  isExecutionFailedMessage,
} from "./ws-guards.ts";
import type { WsMessage } from "./ws-types.ts";

const agentStatusPendingMessage: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "pending",
};

const agentStatusRunningMessage: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "running",
  timestamp: "2026-04-17T10:00:00Z",
};

const agentStatusCompletedMessage: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "completed",
  timestamp: "2026-04-17T10:00:30Z",
};

const agentStatusFailedMessage: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "failed",
  reason: "llm_error",
  timestamp: "2026-04-17T10:00:30Z",
};

const agentOutputMessage: WsMessage = {
  type: "agent:output",
  agentId: "investigation:strategy",
  chunk: "..",
};

const executionCompletedMessage: WsMessage = {
  type: "execution:completed",
  executionId: "exec_1",
  resultId: "res_1",
};

const executionFailedMessage: WsMessage = {
  type: "execution:failed",
  executionId: "exec_1",
  reason: "all_investigations_failed",
};

/**
 * union の全メンバーを列挙したリスト。
 * 各ガードのネガティブテストで「対象以外の全メンバーが false になる」ことを
 * 網羅検証するために共有する。新しい WsMessage バリアント追加時は本リストにも
 * 1 件追加することで、既存ガードの網羅性が自動で維持される。
 */
const allMessages: WsMessage[] = [
  agentStatusPendingMessage,
  agentStatusRunningMessage,
  agentStatusCompletedMessage,
  agentStatusFailedMessage,
  agentOutputMessage,
  executionCompletedMessage,
  executionFailedMessage,
];

describe("isAgentStatusMessage", () => {
  test("agent:status の全 4 バリアントを識別する", () => {
    expect(isAgentStatusMessage(agentStatusPendingMessage)).toBe(true);
    expect(isAgentStatusMessage(agentStatusRunningMessage)).toBe(true);
    expect(isAgentStatusMessage(agentStatusCompletedMessage)).toBe(true);
    expect(isAgentStatusMessage(agentStatusFailedMessage)).toBe(true);
  });

  test("agent:status 以外は全て false", () => {
    const others = allMessages.filter((m) => m.type !== "agent:status");
    for (const m of others) {
      expect(isAgentStatusMessage(m)).toBe(false);
    }
  });
});

describe("isAgentOutputMessage", () => {
  test("agent:output を識別する", () => {
    expect(isAgentOutputMessage(agentOutputMessage)).toBe(true);
  });

  test("agent:output 以外は全て false", () => {
    const others = allMessages.filter((m) => m.type !== "agent:output");
    for (const m of others) {
      expect(isAgentOutputMessage(m)).toBe(false);
    }
  });
});

describe("isExecutionCompletedMessage", () => {
  test("execution:completed を識別する", () => {
    expect(isExecutionCompletedMessage(executionCompletedMessage)).toBe(true);
  });

  test("execution:completed 以外は全て false", () => {
    const others = allMessages.filter((m) => m.type !== "execution:completed");
    for (const m of others) {
      expect(isExecutionCompletedMessage(m)).toBe(false);
    }
  });
});

describe("isExecutionFailedMessage", () => {
  test("execution:failed を識別する", () => {
    expect(isExecutionFailedMessage(executionFailedMessage)).toBe(true);
  });

  test("execution:failed 以外は全て false", () => {
    const others = allMessages.filter((m) => m.type !== "execution:failed");
    for (const m of others) {
      expect(isExecutionFailedMessage(m)).toBe(false);
    }
  });
});
