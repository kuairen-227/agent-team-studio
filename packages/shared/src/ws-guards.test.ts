import { describe, expect, test } from "bun:test";
import {
  isAgentOutputMessage,
  isAgentStatusFailed,
  isAgentStatusMessage,
  isExecutionCompletedMessage,
  isExecutionFailedMessage,
} from "./ws-guards.ts";
import type { WsMessage } from "./ws-types.ts";

const agentStatusRunning: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "running",
  timestamp: "2026-04-17T10:00:00Z",
};

const agentStatusFailed: WsMessage = {
  type: "agent:status",
  agentId: "investigation:strategy",
  status: "failed",
  reason: "llm_error",
  timestamp: "2026-04-17T10:00:00Z",
};

const agentOutput: WsMessage = {
  type: "agent:output",
  agentId: "investigation:strategy",
  chunk: "..",
};

const executionCompleted: WsMessage = {
  type: "execution:completed",
  executionId: "exec_1",
  resultId: "res_1",
};

const executionFailed: WsMessage = {
  type: "execution:failed",
  executionId: "exec_1",
  reason: "all_investigations_failed",
};

describe("isAgentStatusMessage", () => {
  test("agent:status を識別する", () => {
    expect(isAgentStatusMessage(agentStatusRunning)).toBe(true);
    expect(isAgentStatusMessage(agentStatusFailed)).toBe(true);
  });

  test("他の type は false", () => {
    expect(isAgentStatusMessage(agentOutput)).toBe(false);
    expect(isAgentStatusMessage(executionCompleted)).toBe(false);
    expect(isAgentStatusMessage(executionFailed)).toBe(false);
  });
});

describe("isAgentStatusFailed", () => {
  test("status=failed のみ true", () => {
    expect(isAgentStatusFailed(agentStatusFailed)).toBe(true);
    expect(isAgentStatusFailed(agentStatusRunning)).toBe(false);
  });

  test("ナローイング後に reason へ安全にアクセスできる", () => {
    if (isAgentStatusFailed(agentStatusFailed)) {
      // 型レベルで reason へアクセスできることを確認
      expect(agentStatusFailed.reason).toBe("llm_error");
    }
  });
});

describe("isAgentOutputMessage", () => {
  test("agent:output を識別する", () => {
    expect(isAgentOutputMessage(agentOutput)).toBe(true);
    expect(isAgentOutputMessage(agentStatusRunning)).toBe(false);
  });
});

describe("isExecutionCompletedMessage", () => {
  test("execution:completed を識別する", () => {
    expect(isExecutionCompletedMessage(executionCompleted)).toBe(true);
    expect(isExecutionCompletedMessage(executionFailed)).toBe(false);
  });
});

describe("isExecutionFailedMessage", () => {
  test("execution:failed を識別する", () => {
    expect(isExecutionFailedMessage(executionFailed)).toBe(true);
    expect(isExecutionFailedMessage(executionCompleted)).toBe(false);
  });
});
