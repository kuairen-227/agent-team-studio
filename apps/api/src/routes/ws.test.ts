/**
 * WS ルート (`/ws?executionId=<id>`) の統合テスト。
 *
 * Bun のネイティブ WS サポートにより実際のサーバーを立ち上げてテストする。
 * ポート 0 指定で OS がランダムポートを割り当てるため並列実行と干渉しない。
 */

import { afterEach, describe, expect, test } from "bun:test";
import type {
  AgentExecutionRow,
  ExecutionRow,
  ResultRow,
} from "@agent-team-studio/db";
import type { WsMessage } from "@agent-team-studio/shared";
import { fixtureTemplate } from "../_test-fixtures.ts";
import { type AppDeps, createApp } from "../app.ts";
import { websocket } from "../lib/ws.ts";

// ---------- テストサーバーユーティリティ ----------

type BunServer = ReturnType<typeof Bun.serve>;

function buildServer(overrides: Partial<AppDeps> = {}): BunServer {
  const app = createApp({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => fixtureTemplate,
    createExecution: async () => ({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    }),
    getExecution: async () => null,
    getAgentExecutionsByExecutionId: async () => [],
    getResultByExecutionId: async () => null,
    listExecutions: async () => [],
    startExecution: () => {},
    subscribeToExecution: () => () => {},
    ...overrides,
  });
  return Bun.serve({ port: 0, fetch: app.fetch, websocket });
}

type WsResult = {
  messages: WsMessage[];
  closeCode: number;
};

function connectAndWait(
  server: BunServer,
  executionId: string,
): Promise<WsResult> {
  return new Promise((resolve) => {
    const messages: WsMessage[] = [];
    const ws = new WebSocket(
      `ws://localhost:${server.port}/ws?executionId=${encodeURIComponent(executionId)}`,
    );

    ws.onmessage = (e) => {
      try {
        messages.push(JSON.parse(e.data as string) as WsMessage);
      } catch {}
    };

    ws.onclose = (e) => {
      resolve({ messages, closeCode: e.code });
    };

    ws.onerror = () => {
      resolve({ messages, closeCode: 0 });
    };
  });
}

// ---------- フィクスチャ ----------

const baseExecution: ExecutionRow = {
  id: "exec-1",
  templateId: "tpl-1",
  parameters: { competitors: ["Acme"] },
  status: "pending",
  errorMessage: null,
  createdAt: new Date("2026-05-04T00:00:00.000Z"),
  startedAt: null,
  completedAt: null,
};

const completedExecution: ExecutionRow = {
  ...baseExecution,
  id: "exec-completed",
  status: "completed",
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
  completedAt: new Date("2026-05-04T00:02:00.000Z"),
};

const failedExecution: ExecutionRow = {
  ...baseExecution,
  id: "exec-failed",
  status: "failed",
  errorMessage: "internal_error",
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
  completedAt: new Date("2026-05-04T00:02:00.000Z"),
};

const runningExecution: ExecutionRow = {
  ...baseExecution,
  id: "exec-running",
  status: "running",
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
};

const resultRow: ResultRow = {
  id: "result-1",
  executionId: "exec-completed",
  markdown: "# レポート",
  structured: { matrix: [], overall_insights: [], missing: [] },
  createdAt: new Date("2026-05-04T00:02:00.000Z"),
};

const completedAgentRow: AgentExecutionRow = {
  id: "ae-1",
  executionId: "exec-completed",
  agentId: "investigation_strategy",
  role: "investigation",
  status: "completed",
  output: null,
  errorMessage: null,
  createdAt: new Date("2026-05-04T00:00:00.000Z"),
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
  completedAt: new Date("2026-05-04T00:02:00.000Z"),
};

// ---------- テスト ----------

let server: BunServer;

afterEach(() => {
  server?.stop(true);
});

describe("WS バリデーション", () => {
  test("executionId が形式不正なら close(4404) で終了", async () => {
    server = buildServer();

    const result = await connectAndWait(server, "!!invalid!!");

    expect(result.closeCode).toBe(4404);
  });

  test("executionId が存在しない場合 close(4404) で終了", async () => {
    server = buildServer({ getExecution: async () => null });

    const result = await connectAndWait(server, "exec-missing");

    expect(result.closeCode).toBe(4404);
  });
});

describe("WS 完了済み Execution", () => {
  test("スナップショット + execution:completed を送信して close(1000) で終了", async () => {
    server = buildServer({
      getExecution: async () => completedExecution,
      getAgentExecutionsByExecutionId: async () => [completedAgentRow],
      getResultByExecutionId: async () => resultRow,
    });

    const result = await connectAndWait(server, "exec-completed");

    expect(result.closeCode).toBe(1000);
    const statusMsg = result.messages.find((m) => m.type === "agent:status");
    expect(statusMsg).toBeDefined();
    const completedMsg = result.messages.find(
      (m) => m.type === "execution:completed",
    );
    expect(completedMsg).toBeDefined();
    expect(
      (completedMsg as Extract<WsMessage, { type: "execution:completed" }>)
        .resultId,
    ).toBe("result-1");
  });

  test("completed だが result が null のとき close(1011) で終了", async () => {
    server = buildServer({
      getExecution: async () => completedExecution,
      getResultByExecutionId: async () => null,
    });

    const result = await connectAndWait(server, "exec-completed");

    expect(result.closeCode).toBe(1011);
  });
});

describe("WS 失敗済み Execution", () => {
  test("execution:failed を送信して close(1000) で終了", async () => {
    server = buildServer({
      getExecution: async () => failedExecution,
    });

    const result = await connectAndWait(server, "exec-failed");

    expect(result.closeCode).toBe(1000);
    const failedMsg = result.messages.find(
      (m) => m.type === "execution:failed",
    );
    expect(failedMsg).toBeDefined();
  });
});

describe("WS 進行中 Execution", () => {
  test("subscribe が呼ばれる", async () => {
    let subscribed = false;
    server = buildServer({
      getExecution: async () => runningExecution,
      subscribeToExecution: (_id, _handler) => {
        subscribed = true;
        return () => {};
      },
    });

    await new Promise<void>((resolve) => {
      const ws = new WebSocket(
        `ws://localhost:${server.port}/ws?executionId=exec-running`,
      );
      ws.onopen = () => {
        // onOpen が完了するまで少し待ってから切断する。
        setTimeout(() => {
          ws.close();
          resolve();
        }, 50);
      };
      ws.onerror = () => resolve();
    });

    expect(subscribed).toBe(true);
  });
});
