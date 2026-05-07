/**
 * engine.ts のユニットテスト。
 *
 * すべての外部依存（DB ops, LLM stream, agent runners）を fake で注入し、
 * engine のオーケストレーションロジックのみを検証する。
 */

import { describe, expect, test } from "bun:test";
import type {
  AgentRole,
  CompetitorAnalysisParameters,
  TemplateDefinition,
} from "@agent-team-studio/shared";
import type { AgentExecutionPatch } from "./agent.ts";
import type {
  EngineRunDeps,
  EngineRunInput,
  ExecutionUpdatePatch,
  InsertResultInput,
} from "./engine.ts";
import { runExecution } from "./engine.ts";
import type { AgentEvent } from "./events.ts";
import type { LlmInput } from "./llm-client.ts";

// ---- フィクスチャ ----

const baseLlm = {
  model: "claude-sonnet-4-6",
  temperature_by_role: { investigation: 0.3, integration: 0.2 },
  max_tokens_by_role: { investigation: 2048, integration: 4096 },
};

const baseParams: CompetitorAnalysisParameters = {
  competitors: ["CompanyA", "CompanyB"],
};

const templateDefinition: TemplateDefinition = {
  schema_version: "1",
  input_schema: {},
  llm: baseLlm,
  agents: [
    {
      role: "investigation",
      agent_id: "investigation:strategy",
      specialization: {
        perspective_key: "strategy",
        perspective_name_ja: "戦略",
        perspective_description: "事業戦略",
      },
      system_prompt_template: "調査プロンプト {{competitors}}",
    },
    {
      role: "investigation",
      agent_id: "investigation:product",
      specialization: {
        perspective_key: "product",
        perspective_name_ja: "製品",
        perspective_description: "製品情報",
      },
      system_prompt_template: "調査プロンプト {{competitors}}",
    },
    {
      role: "integration",
      agent_id: "integration:matrix",
      system_prompt_template: "統合プロンプト {{investigation_results}}",
    },
  ],
};

const agentExecutions: EngineRunInput["agentExecutions"] = [
  {
    id: "ae-1",
    agentId: "investigation:strategy",
    role: "investigation" as AgentRole,
  },
  {
    id: "ae-2",
    agentId: "investigation:product",
    role: "investigation" as AgentRole,
  },
  {
    id: "ae-3",
    agentId: "integration:matrix",
    role: "integration" as AgentRole,
  },
];

const baseInput: EngineRunInput = {
  executionId: "exec-1",
  parameters: baseParams,
  templateDefinition,
  agentExecutions,
};

const successInvestigationOutput = {
  perspective: "strategy" as const,
  findings: [
    {
      competitor: "CompanyA",
      points: ["点1"],
      evidence_level: "strong" as const,
    },
  ],
};

const successIntegrationOutput = {
  matrix: [
    {
      perspective: "strategy" as const,
      cells: [
        {
          competitor: "CompanyA",
          summary: "要約",
          source_evidence_level: "strong" as const,
        },
      ],
    },
  ],
  overall_insights: ["所見1"],
  missing: [],
};

const validIntegrationRaw = `## レポート\n\n${JSON.stringify(successIntegrationOutput)}`;

// ---- fake stream ヘルパー ----

function makeStream(
  chunks: string[],
): (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string> {
  return async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  };
}

// Investigation Agent が成功するストリーム
const investigationStream = makeStream([
  JSON.stringify(successInvestigationOutput),
]);
// Integration Agent が成功するストリーム
const integrationStream = makeStream([validIntegrationRaw]);

// ---- fake deps ヘルパー ----

type FakeDeps = EngineRunDeps & {
  executionPatches: Array<{ id: string; patch: ExecutionUpdatePatch }>;
  agentPatches: Array<{ id: string; patch: AgentExecutionPatch }>;
  insertedResults: InsertResultInput[];
  events: AgentEvent[];
};

function makeFakeDeps(
  streamFn?: (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string>,
  opts?: {
    insertResultFn?: (input: InsertResultInput) => Promise<string>;
    agentTimeoutMs?: number;
    executionTimeoutMs?: number;
  },
): FakeDeps {
  const executionPatches: Array<{ id: string; patch: ExecutionUpdatePatch }> =
    [];
  const agentPatches: Array<{ id: string; patch: AgentExecutionPatch }> = [];
  const insertedResults: InsertResultInput[] = [];
  const events: AgentEvent[] = [];

  // デフォルト: Investigation → 成功JSON, Integration → validIntegrationRaw
  const defaultStream = (
    input: LlmInput,
    signal?: AbortSignal,
  ): AsyncIterable<string> => {
    // integration は investigation_results が JSON 展開されるため "findings" キーを含む
    if (input.system.includes('"findings"'))
      return integrationStream(input, signal);
    return investigationStream(input, signal);
  };

  return {
    updateExecution: async (id, patch) => {
      executionPatches.push({ id, patch });
    },
    updateAgentExecution: async (id, patch) => {
      agentPatches.push({ id, patch });
    },
    insertResult:
      opts?.insertResultFn ??
      (async (input) => {
        insertedResults.push(input);
        return "result-1";
      }),
    onEvent: (event) => {
      events.push(event);
    },
    _stream: streamFn ?? defaultStream,
    agentTimeoutMs: opts?.agentTimeoutMs,
    executionTimeoutMs: opts?.executionTimeoutMs,
    executionPatches,
    agentPatches,
    insertedResults,
    events,
  };
}

// ---- テスト ----

describe("runExecution", () => {
  test("全 Investigation 成功 + Integration 成功 → execution_completed を発行し Result を INSERT する", async () => {
    const deps = makeFakeDeps();
    await runExecution(baseInput, deps);

    const completedEvent = deps.events.find(
      (e) => e.kind === "execution_completed",
    );
    expect(completedEvent).toBeDefined();
    if (completedEvent?.kind === "execution_completed") {
      expect(completedEvent.resultId).toBe("result-1");
    }

    expect(deps.insertedResults).toHaveLength(1);
    expect(deps.insertedResults[0]?.executionId).toBe("exec-1");
  });

  test("全 Investigation 成功 + Integration 成功 → Execution.status が completed に更新される", async () => {
    const deps = makeFakeDeps();
    await runExecution(baseInput, deps);

    const finalPatch = deps.executionPatches[deps.executionPatches.length - 1];
    expect(finalPatch?.patch.status).toBe("completed");
  });

  test("DB UPDATE → execution_completed イベント発行の順序を保証する", async () => {
    const order: string[] = [];
    const deps = makeFakeDeps();
    const origUpdate = deps.updateExecution;
    deps.updateExecution = async (id, patch) => {
      order.push(`db:${patch.status}`);
      return origUpdate(id, patch);
    };
    const origOnEvent = deps.onEvent;
    deps.onEvent = (event) => {
      order.push(event.kind);
      origOnEvent(event);
    };

    await runExecution(baseInput, deps);

    const dbCompletedIdx = order.lastIndexOf("db:completed");
    const eventCompletedIdx = order.indexOf("execution_completed");
    expect(dbCompletedIdx).toBeGreaterThanOrEqual(0);
    expect(eventCompletedIdx).toBeGreaterThan(dbCompletedIdx);
  });

  test("全 Investigation 失敗 → execution_failed('all_investigations_failed') を発行する", async () => {
    // 全 agent で無効 JSON を返す（parse 失敗 → agent_failed）
    const failStream = makeStream(["invalid json for all"]);
    const deps = makeFakeDeps(failStream);
    await runExecution(baseInput, deps);

    const failEvent = deps.events.find((e) => e.kind === "execution_failed");
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "execution_failed") {
      expect(failEvent.reason).toBe("all_investigations_failed");
    }

    // Result は INSERT されない
    expect(deps.insertedResults).toHaveLength(0);
  });

  test("全 Investigation 失敗 → Execution.status が failed に更新される", async () => {
    const failStream = makeStream(["invalid json"]);
    const deps = makeFakeDeps(failStream);
    await runExecution(baseInput, deps);

    const finalPatch = deps.executionPatches[deps.executionPatches.length - 1];
    expect(finalPatch?.patch.status).toBe("failed");
  });

  test("部分 Investigation 失敗 + Integration 成功 → execution_completed を発行する", async () => {
    let callCount = 0;
    const partialStream = (
      input: LlmInput,
      signal?: AbortSignal,
    ): AsyncIterable<string> => {
      if (input.system.includes('"findings"'))
        return integrationStream(input, signal);
      callCount++;
      // 1回目は失敗、2回目以降は成功
      if (callCount === 1) return makeStream(["invalid json"])(input, signal);
      return investigationStream(input, signal);
    };

    const deps = makeFakeDeps(partialStream);
    await runExecution(baseInput, deps);

    const completedEvent = deps.events.find(
      (e) => e.kind === "execution_completed",
    );
    expect(completedEvent).toBeDefined();
    expect(deps.insertedResults).toHaveLength(1);
  });

  test("Integration 失敗 → execution_failed('integration_failed') を発行する", async () => {
    const mixedStream = (
      input: LlmInput,
      signal?: AbortSignal,
    ): AsyncIterable<string> => {
      if (input.system.includes('"findings"'))
        // Integration は無効出力（パース失敗）
        return makeStream(["no matrix here"])(input, signal);
      return investigationStream(input, signal);
    };

    const deps = makeFakeDeps(mixedStream);
    await runExecution(baseInput, deps);

    const failEvent = deps.events.find((e) => e.kind === "execution_failed");
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "execution_failed") {
      expect(failEvent.reason).toBe("integration_failed");
    }

    expect(deps.insertedResults).toHaveLength(0);
  });

  test("Execution 開始時に Execution.status が running に更新される", async () => {
    const deps = makeFakeDeps();
    await runExecution(baseInput, deps);

    const firstPatch = deps.executionPatches[0];
    expect(firstPatch?.patch.status).toBe("running");
    expect(firstPatch?.id).toBe("exec-1");
  });

  test("エージェント単位タイムアウト → agent_failed('timeout') が発行される", async () => {
    // 1ms タイムアウトで即座に中断される stream を用意
    const slowStream = (
      _input: LlmInput,
      signal?: AbortSignal,
    ): AsyncIterable<string> => {
      async function* gen() {
        await new Promise<void>((resolve, reject) => {
          const id = setTimeout(resolve, 5000);
          signal?.addEventListener("abort", () => {
            clearTimeout(id);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        yield "never reached";
      }
      return gen();
    };

    const deps = makeFakeDeps(slowStream, { agentTimeoutMs: 1 });
    await runExecution(baseInput, deps);

    const timeoutEvent = deps.events.find(
      (e) => e.kind === "agent_failed" && e.reason === "timeout",
    );
    expect(timeoutEvent).toBeDefined();
  });

  test("Execution 全体タイムアウト → execution_failed('timeout') が発行される", async () => {
    const slowStream = (
      _input: LlmInput,
      signal?: AbortSignal,
    ): AsyncIterable<string> => {
      async function* gen() {
        await new Promise<void>((resolve, reject) => {
          const id = setTimeout(resolve, 5000);
          signal?.addEventListener("abort", () => {
            clearTimeout(id);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        yield "never reached";
      }
      return gen();
    };

    // execution タイムアウトは agent タイムアウトより短く設定
    const deps = makeFakeDeps(slowStream, {
      agentTimeoutMs: 5000,
      executionTimeoutMs: 1,
    });
    await runExecution(baseInput, deps);

    const failEvent = deps.events.find((e) => e.kind === "execution_failed");
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "execution_failed") {
      expect(failEvent.reason).toBe("timeout");
    }
  });

  test("insertResult が throw → execution_failed('internal_error') を発行し execution が running のまま残らない", async () => {
    const deps = makeFakeDeps(undefined, {
      insertResultFn: async () => {
        throw new Error("DB connection error");
      },
    });

    await expect(runExecution(baseInput, deps)).rejects.toThrow(
      "DB connection error",
    );

    const failEvent = deps.events.find((e) => e.kind === "execution_failed");
    expect(failEvent).toBeDefined();
    if (failEvent?.kind === "execution_failed") {
      expect(failEvent.reason).toBe("internal_error");
    }

    const finalPatch = deps.executionPatches[deps.executionPatches.length - 1];
    expect(finalPatch?.patch.status).toBe("failed");
  });
});
