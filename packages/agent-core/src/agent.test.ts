import { describe, expect, test } from "bun:test";
import type {
  AgentDeps,
  AgentExecutionPatch,
  IntegrationAgentRunInput,
  InvestigationAgentRunInput,
} from "./agent.ts";
import { runIntegrationAgent, runInvestigationAgent } from "./agent.ts";
import type { AgentEvent } from "./events.ts";
import type { LlmInput } from "./llm-client.ts";

// ---- フィクスチャ ----

const baseLlm = {
  model: "claude-sonnet-4-6",
  temperature_by_role: { investigation: 0.3, integration: 0.2 },
  max_tokens_by_role: { investigation: 2048, integration: 4096 },
};

const baseParams = { competitors: ["CompanyA", "CompanyB"] };

const investigationDef = {
  role: "investigation" as const,
  agent_id: "investigation:strategy",
  specialization: {
    perspective_key: "strategy",
    perspective_name_ja: "戦略",
    perspective_description: "事業戦略",
  },
  system_prompt_template:
    "あなたは専門家です。観点: {{perspective_name_ja}}。企業: {{competitors}}。{{reference_or_empty}}",
};

const integrationDef = {
  role: "integration" as const,
  agent_id: "integration:matrix",
  system_prompt_template:
    "統合エージェント。企業: {{competitors}}。調査結果: {{investigation_results}}。{{reference_or_empty}}",
};

const validInvestigationJson = JSON.stringify({
  perspective: "strategy",
  findings: [
    {
      competitor: "CompanyA",
      points: ["点1"],
      evidence_level: "strong",
    },
  ],
});

const validIntegrationOutput = {
  matrix: [
    {
      perspective: "strategy",
      cells: [
        {
          competitor: "CompanyA",
          summary: "要約",
          source_evidence_level: "strong",
        },
      ],
    },
  ],
  overall_insights: ["所見1"],
  missing: [],
};

const validIntegrationRaw = `## Markdown レポート\n\nマトリクス\n\n${JSON.stringify(validIntegrationOutput)}`;

// ---- ヘルパー ----

function makeDeps(
  streamChunks: string[],
  overrides?: Partial<AgentDeps>,
): AgentDeps & {
  capturedPatches: Array<{ id: string; patch: AgentExecutionPatch }>;
  capturedEvents: AgentEvent[];
} {
  const capturedPatches: Array<{ id: string; patch: AgentExecutionPatch }> = [];
  const capturedEvents: AgentEvent[] = [];

  async function* fakeStream(): AsyncIterable<string> {
    for (const chunk of streamChunks) {
      yield chunk;
    }
  }

  return {
    stream:
      overrides?.stream ??
      ((_input: LlmInput, _signal?: AbortSignal) => fakeStream()),
    updateAgentExecution:
      overrides?.updateAgentExecution ??
      (async (id: string, patch: AgentExecutionPatch) => {
        capturedPatches.push({ id, patch });
      }),
    onEvent:
      overrides?.onEvent ??
      ((event: AgentEvent) => {
        capturedEvents.push(event);
      }),
    capturedPatches,
    capturedEvents,
  };
}

const baseInvestigationInput: InvestigationAgentRunInput = {
  agentExecutionId: "ae-1",
  agentId: "investigation:strategy",
  definition: investigationDef,
  parameters: baseParams,
  llm: baseLlm,
  signal: new AbortController().signal,
};

const baseIntegrationInput: IntegrationAgentRunInput = {
  agentExecutionId: "ae-5",
  agentId: "integration:matrix",
  definition: integrationDef,
  parameters: baseParams,
  successfulInvestigations: [
    {
      agentId: "investigation:strategy",
      output: {
        perspective: "strategy",
        findings: [
          { competitor: "CompanyA", points: ["点1"], evidence_level: "strong" },
        ],
      },
    },
  ],
  llm: baseLlm,
  signal: new AbortController().signal,
};

// ---- Investigation Agent テスト ----

describe("runInvestigationAgent", () => {
  test("正常系: agent_started → chunk* → agent_completed のイベントシーケンスを発行する", async () => {
    // 有効な JSON を複数チャンクに分割して渡す
    const chunk1 = validInvestigationJson.slice(0, 20);
    const chunk2 = validInvestigationJson.slice(20);
    const deps = makeDeps([chunk1, chunk2]);
    const result = await runInvestigationAgent(
      { ...baseInvestigationInput },
      deps,
    );

    expect(result.success).toBe(true);

    const kinds = deps.capturedEvents.map((e) => e.kind);
    expect(kinds[0]).toBe("agent_started");
    expect(kinds.slice(1, -1)).toEqual([
      "agent_output_chunk",
      "agent_output_chunk",
    ]);
    expect(kinds[kinds.length - 1]).toBe("agent_completed");
  });

  test("正常系: LLM 出力を JSON パースして output を返す", async () => {
    const deps = makeDeps([validInvestigationJson]);
    const result = await runInvestigationAgent(
      { ...baseInvestigationInput },
      deps,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.perspective).toBe("strategy");
      expect(result.output.findings).toHaveLength(1);
    }
  });

  test("正常系: DB 更新は「running → completed」の順で行われる", async () => {
    const deps = makeDeps([validInvestigationJson]);
    await runInvestigationAgent({ ...baseInvestigationInput }, deps);

    const statuses = deps.capturedPatches.map((p) => p.patch.status);
    expect(statuses).toEqual(["running", "completed"]);
  });

  test("正常系: DB UPDATE が agent_started より前に実行される（副作用順序）", async () => {
    const order: string[] = [];
    const deps = makeDeps([validInvestigationJson], {
      updateAgentExecution: async (_id, _patch) => {
        order.push("db");
      },
      onEvent: (event) => {
        order.push(event.kind);
      },
    });

    await runInvestigationAgent({ ...baseInvestigationInput }, deps);

    // DB UPDATE → agent_started の順序を確認
    expect(order[0]).toBe("db");
    expect(order[1]).toBe("agent_started");
  });

  test("LLM エラー → agent_failed('llm_error') を発行し { success: false } を返す", async () => {
    // LlmError を発生させる stream を注入
    const { LlmError } = await import("./llm-client.ts");

    // biome-ignore lint/correctness/useYield: throw のみのストリームテスト用ジェネレーター
    async function* errorStream(): AsyncIterable<string> {
      throw new LlmError("llm_error", "API error");
    }

    const deps = makeDeps([], { stream: () => errorStream() });
    const result = await runInvestigationAgent(
      { ...baseInvestigationInput },
      deps,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("llm_error");
    }

    const failEvent = deps.capturedEvents.find(
      (e) => e.kind === "agent_failed",
    );
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "agent_failed") {
      expect(failEvent.reason).toBe("llm_error");
    }
  });

  test("出力 JSON パース失敗 → agent_failed('output_parse_error') を発行する", async () => {
    const deps = makeDeps(["not valid json"]);
    const result = await runInvestigationAgent(
      { ...baseInvestigationInput },
      deps,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("output_parse_error");
    }

    const failEvent = deps.capturedEvents.find(
      (e) => e.kind === "agent_failed",
    );
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "agent_failed") {
      expect(failEvent.reason).toBe("output_parse_error");
    }
  });

  test("AbortError → agent_failed('timeout') を発行する", async () => {
    const controller = new AbortController();

    // biome-ignore lint/correctness/useYield: throw のみのストリームテスト用ジェネレーター
    async function* abortedStream(): AsyncIterable<string> {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    }

    const deps = makeDeps([], { stream: () => abortedStream() });
    const result = await runInvestigationAgent(
      { ...baseInvestigationInput, signal: controller.signal },
      deps,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("timeout");
    }

    const failEvent = deps.capturedEvents.find(
      (e) => e.kind === "agent_failed",
    );
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "agent_failed") {
      expect(failEvent.reason).toBe("timeout");
    }
  });

  test("失敗時: DB が failed で更新された後にイベントが発行される（副作用順序）", async () => {
    const order: string[] = [];
    const deps = makeDeps(["invalid json"], {
      updateAgentExecution: async (_id, patch) => {
        order.push(`db:${patch.status}`);
      },
      onEvent: (event) => {
        order.push(event.kind);
      },
    });

    await runInvestigationAgent({ ...baseInvestigationInput }, deps);

    const failDbIdx = order.indexOf("db:failed");
    const failEventIdx = order.indexOf("agent_failed");
    expect(failDbIdx).toBeGreaterThanOrEqual(0);
    expect(failEventIdx).toBeGreaterThan(failDbIdx);
  });
});

// ---- Integration Agent テスト ----

describe("runIntegrationAgent", () => {
  test("正常系: agent_started → chunk* → agent_completed のイベントシーケンスを発行する", async () => {
    const deps = makeDeps([validIntegrationRaw]);
    const result = await runIntegrationAgent({ ...baseIntegrationInput }, deps);

    expect(result.success).toBe(true);

    const kinds = deps.capturedEvents.map((e) => e.kind);
    expect(kinds[0]).toBe("agent_started");
    expect(kinds[kinds.length - 1]).toBe("agent_completed");
  });

  test("正常系: Markdown と構造化出力の両方を返す", async () => {
    const deps = makeDeps([validIntegrationRaw]);
    const result = await runIntegrationAgent({ ...baseIntegrationInput }, deps);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.markdown).toContain("Markdown");
      expect(result.output.matrix).toHaveLength(1);
      expect(result.output.overall_insights).toHaveLength(1);
    }
  });

  test("出力パース失敗 → agent_failed('output_parse_error')", async () => {
    const deps = makeDeps(["Markdown only, no JSON"]);
    const result = await runIntegrationAgent({ ...baseIntegrationInput }, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("output_parse_error");
    }
  });

  test("LLM エラー → agent_failed('llm_error')", async () => {
    const { LlmError } = await import("./llm-client.ts");

    // biome-ignore lint/correctness/useYield: throw のみのストリームテスト用ジェネレーター
    async function* errorStream(): AsyncIterable<string> {
      throw new LlmError("llm_error", "API error");
    }

    const deps = makeDeps([], { stream: () => errorStream() });
    const result = await runIntegrationAgent({ ...baseIntegrationInput }, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("llm_error");
    }
  });

  test("investigation_results プレースホルダに成功した調査結果が展開される", async () => {
    let capturedSystem = "";

    async function* captureStream(input: LlmInput): AsyncIterable<string> {
      capturedSystem = input.system;
      yield validIntegrationRaw;
    }

    const deps = makeDeps([], { stream: (input) => captureStream(input) });
    await runIntegrationAgent({ ...baseIntegrationInput }, deps);

    expect(capturedSystem).toContain("strategy");
  });
});
