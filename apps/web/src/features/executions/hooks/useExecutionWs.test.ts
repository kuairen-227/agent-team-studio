import { describe, expect, test } from "bun:test";
import { reducer } from "./useExecutionWs.ts";

const INITIAL: Parameters<typeof reducer>[0] = { phase: "connecting" };

describe("reducer / connected", () => {
  test("connecting → running（agents 空）", () => {
    const next = reducer(INITIAL, { type: "connected" });
    expect(next.phase).toBe("running");
    if (next.phase === "running") {
      expect(next.agents.size).toBe(0);
    }
  });
});

describe("reducer / ws_error", () => {
  test("connecting 中のエラーは agents 空の error フェーズ", () => {
    const next = reducer(INITIAL, { type: "ws_error", code: 4404 });
    expect(next.phase).toBe("error");
    if (next.phase === "error") {
      expect(next.code).toBe(4404);
      expect(next.agents.size).toBe(0);
    }
  });

  test("running 中のエラーは既存 agents を引き継ぐ", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const withAgent = reducer(running, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "running",
        timestamp: "2026-05-04T00:01:00Z",
      },
    });
    const next = reducer(withAgent, { type: "ws_error", code: 1011 });
    expect(next.phase).toBe("error");
    if (next.phase === "error") {
      expect(next.code).toBe(1011);
      expect(next.agents.size).toBeGreaterThan(0);
    }
  });
});

describe("reducer / message: agent:status", () => {
  test("新しい agentId を agents に追加する", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const next = reducer(running, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "running",
        timestamp: "2026-05-04T00:01:00Z",
      },
    });
    expect(next.phase).toBe("running");
    if (next.phase === "running") {
      expect(next.agents.get("investigation_strategy")?.status).toBe("running");
    }
  });

  test("failed ステータスで reason を保持する", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const next = reducer(running, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "failed",
        reason: "llm_error",
        timestamp: "2026-05-04T00:02:00Z",
      },
    });
    if (next.phase === "running") {
      expect(next.agents.get("investigation_strategy")?.failReason).toBe(
        "llm_error",
      );
    }
  });

  test("completed フェーズ後の agent:status は無視する（逆行防止）", () => {
    const completed: Parameters<typeof reducer>[0] = {
      phase: "completed",
      resultId: "res-1",
      agents: new Map(),
    };
    const next = reducer(completed, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "running",
        timestamp: "2026-05-04T00:01:00Z",
      },
    });
    expect(next.phase).toBe("completed");
  });

  test("failed フェーズ後の agent:status は無視する（逆行防止）", () => {
    const failed: Parameters<typeof reducer>[0] = {
      phase: "failed",
      reason: "internal_error",
      agents: new Map(),
    };
    const next = reducer(failed, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "running",
        timestamp: "2026-05-04T00:01:00Z",
      },
    });
    expect(next.phase).toBe("failed");
  });
});

describe("reducer / message: agent:output", () => {
  test("chunk を output に追記する", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const withAgent = reducer(running, {
      type: "message",
      msg: {
        type: "agent:status",
        agentId: "investigation_strategy",
        status: "running",
        timestamp: "2026-05-04T00:01:00Z",
      },
    });
    const next = reducer(withAgent, {
      type: "message",
      msg: {
        type: "agent:output",
        agentId: "investigation_strategy",
        chunk: "Hello",
      },
    });
    const next2 = reducer(next, {
      type: "message",
      msg: {
        type: "agent:output",
        agentId: "investigation_strategy",
        chunk: " World",
      },
    });
    if (next2.phase === "running") {
      expect(next2.agents.get("investigation_strategy")?.output).toBe(
        "Hello World",
      );
    }
  });

  test("failed フェーズ後の agent:output は無視する（逆行防止）", () => {
    const failed: Parameters<typeof reducer>[0] = {
      phase: "failed",
      reason: "internal_error",
      agents: new Map(),
    };
    const next = reducer(failed, {
      type: "message",
      msg: {
        type: "agent:output",
        agentId: "investigation_strategy",
        chunk: "late chunk",
      },
    });
    expect(next.phase).toBe("failed");
  });

  test("completed フェーズ後の agent:output は無視する（逆行防止）", () => {
    const completed: Parameters<typeof reducer>[0] = {
      phase: "completed",
      resultId: "res-1",
      agents: new Map(),
    };
    const next = reducer(completed, {
      type: "message",
      msg: {
        type: "agent:output",
        agentId: "investigation_strategy",
        chunk: "late chunk",
      },
    });
    expect(next.phase).toBe("completed");
  });
});

describe("reducer / message: execution:completed", () => {
  test("resultId を保持して completed に遷移する", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const next = reducer(running, {
      type: "message",
      msg: {
        type: "execution:completed",
        executionId: "exec-1",
        resultId: "result-1",
      },
    });
    expect(next.phase).toBe("completed");
    if (next.phase === "completed") {
      expect(next.resultId).toBe("result-1");
    }
  });
});

describe("reducer / message: execution:failed", () => {
  test("reason を保持して failed に遷移する", () => {
    const running = reducer(INITIAL, { type: "connected" });
    const next = reducer(running, {
      type: "message",
      msg: {
        type: "execution:failed",
        executionId: "exec-1",
        reason: "all_investigations_failed",
      },
    });
    expect(next.phase).toBe("failed");
    if (next.phase === "failed") {
      expect(next.reason).toBe("all_investigations_failed");
    }
  });
});
