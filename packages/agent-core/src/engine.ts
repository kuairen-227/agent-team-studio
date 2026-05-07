/**
 * Execution オーケストレーター。
 *
 * Investigation Agent を並列実行し、成功分を Integration Agent に渡して Result を生成する。
 * 副作用はすべて EngineRunDeps 経由で注入するため、DB / LLM の実装に依存しない。
 *
 * SSoT: docs/design/agent-execution.md §6（状態確定フロー）§7（タイムアウト）
 */

import type {
  AgentRole,
  CompetitorAnalysisParameters,
  CompetitorAnalysisResult,
  ExecutionStatus,
  IntegrationAgentDefinition,
  InvestigationAgentDefinition,
  InvestigationAgentOutput,
  TemplateDefinition,
} from "@agent-team-studio/shared";
import type { AgentExecutionPatch } from "./agent.ts";
import { runIntegrationAgent, runInvestigationAgent } from "./agent.ts";
import { AGENT_TIMEOUT_MS, EXECUTION_TIMEOUT_MS } from "./constants.ts";
import type { AgentEvent } from "./events.ts";
import type { LlmInput } from "./llm-client.ts";

// ---------- 公開型 ----------

/** executions テーブルへの書き込みパッチ型。 */
export type ExecutionUpdatePatch = {
  status: ExecutionStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

/** Result INSERT の入力型。 */
export type InsertResultInput = {
  executionId: string;
  markdown: string;
  structured: CompetitorAnalysisResult;
};

/** engine.ts が必要とする外部依存の注入口。 */
export type EngineRunDeps = {
  updateExecution: (id: string, patch: ExecutionUpdatePatch) => Promise<void>;
  updateAgentExecution: (
    id: string,
    patch: AgentExecutionPatch,
  ) => Promise<void>;
  insertResult: (input: InsertResultInput) => Promise<string>;
  onEvent: (event: AgentEvent) => void;
  /** テスト用: 注入された場合は streamAgentMessage の代わりに使う */
  _stream?: (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string>;
  /** テスト用: エージェント単位タイムアウト ms（省略時は定数値を使用） */
  agentTimeoutMs?: number;
  /** テスト用: Execution 全体タイムアウト ms（省略時は定数値を使用） */
  executionTimeoutMs?: number;
};

/** runExecution の入力。 */
export type EngineRunInput = {
  executionId: string;
  parameters: CompetitorAnalysisParameters;
  templateDefinition: TemplateDefinition;
  agentExecutions: { id: string; agentId: string; role: AgentRole }[];
};

// ---------- 内部ヘルパー ----------

function findDefinition(
  templateDefinition: TemplateDefinition,
  agentId: string,
): InvestigationAgentDefinition | IntegrationAgentDefinition | undefined {
  return templateDefinition.agents.find((a) => a.agent_id === agentId);
}

/**
 * Promise.race 用のタイムアウト promise。
 * resolve ではなく reject することで race の勝者を明確にする。
 */
function timeoutSignalPair(ms: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(id),
  };
}

// ---------- メイン ----------

/**
 * Execution を実行する。
 *
 * Investigation → Integration の順で処理し、すべての副作用を deps 経由で行う。
 * タイムアウトは AbortSignal で伝播する。
 */
export async function runExecution(
  input: EngineRunInput,
  deps: EngineRunDeps,
): Promise<void> {
  const streamFn =
    deps._stream ?? (await import("./llm-client.ts")).streamAgentMessage;
  const agentTimeoutMs = deps.agentTimeoutMs ?? AGENT_TIMEOUT_MS;
  const executionTimeoutMs = deps.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS;

  // Execution 全体タイムアウト用 AbortController
  const execTimeout = timeoutSignalPair(executionTimeoutMs);

  try {
    await _runExecution(
      input,
      deps,
      streamFn,
      agentTimeoutMs,
      execTimeout.signal,
    );
  } finally {
    execTimeout.clear();
  }
}

async function _runExecution(
  input: EngineRunInput,
  deps: EngineRunDeps,
  streamFn: (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string>,
  agentTimeoutMs: number,
  executionSignal: AbortSignal,
): Promise<void> {
  const { executionId, parameters, templateDefinition, agentExecutions } =
    input;

  // Execution を running に更新
  await deps.updateExecution(executionId, {
    status: "running",
    startedAt: new Date(),
  });

  const investigationAes = agentExecutions.filter(
    (ae) => ae.role === "investigation",
  );
  const integrationAes = agentExecutions.filter(
    (ae) => ae.role === "integration",
  );

  // ---------- Investigation 並列実行 ----------

  const investigationResults = await runInvestigationsWithTimeout(
    investigationAes,
    parameters,
    templateDefinition,
    deps,
    streamFn,
    agentTimeoutMs,
    executionSignal,
  );

  // Execution タイムアウト確認
  if (executionSignal.aborted) {
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "timeout",
      completedAt: new Date(),
    });
    deps.onEvent({ kind: "execution_failed", reason: "timeout" });
    return;
  }

  const successfulInvestigations = investigationResults.filter(
    (
      r,
    ): r is {
      success: true;
      agentId: string;
      output: InvestigationAgentOutput;
    } => r.success === true,
  );

  if (successfulInvestigations.length === 0) {
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "all_investigations_failed",
      completedAt: new Date(),
    });
    deps.onEvent({
      kind: "execution_failed",
      reason: "all_investigations_failed",
    });
    return;
  }

  // ---------- Integration 実行 ----------

  const integrationAe = integrationAes[0];
  if (!integrationAe) {
    // Integration エージェントが定義されていない（設計上は必ず存在する）
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "integration_failed",
      completedAt: new Date(),
    });
    deps.onEvent({ kind: "execution_failed", reason: "integration_failed" });
    return;
  }

  const integrationDef = findDefinition(
    templateDefinition,
    integrationAe.agentId,
  );
  if (!integrationDef || integrationDef.role !== "integration") {
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "integration_failed",
      completedAt: new Date(),
    });
    deps.onEvent({ kind: "execution_failed", reason: "integration_failed" });
    return;
  }

  // Integration エージェント用 AbortController（agent タイムアウト）
  const agentTimeout = timeoutSignalPair(agentTimeoutMs);
  // Execution タイムアウトでも中断できるよう、両方を監視する合成 signal を作る
  const combinedController = new AbortController();
  const abortCombined = () => combinedController.abort();
  executionSignal.addEventListener("abort", abortCombined);
  agentTimeout.signal.addEventListener("abort", abortCombined);

  const integrationResult = await runIntegrationAgent(
    {
      agentExecutionId: integrationAe.id,
      agentId: integrationAe.agentId,
      definition: integrationDef,
      parameters,
      successfulInvestigations,
      llm: templateDefinition.llm,
      signal: combinedController.signal,
    },
    {
      stream: streamFn,
      updateAgentExecution: deps.updateAgentExecution,
      onEvent: deps.onEvent,
    },
  );

  agentTimeout.clear();
  executionSignal.removeEventListener("abort", abortCombined);
  agentTimeout.signal.removeEventListener("abort", abortCombined);

  if (executionSignal.aborted) {
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "timeout",
      completedAt: new Date(),
    });
    deps.onEvent({ kind: "execution_failed", reason: "timeout" });
    return;
  }

  if (!integrationResult.success) {
    await deps.updateExecution(executionId, {
      status: "failed",
      errorMessage: "integration_failed",
      completedAt: new Date(),
    });
    deps.onEvent({ kind: "execution_failed", reason: "integration_failed" });
    return;
  }

  // ---------- Result INSERT → execution_completed ----------

  const resultId = await deps.insertResult({
    executionId,
    markdown: integrationResult.markdown,
    structured: integrationResult.output as CompetitorAnalysisResult,
  });

  await deps.updateExecution(executionId, {
    status: "completed",
    completedAt: new Date(),
  });
  deps.onEvent({ kind: "execution_completed", resultId });
}

type InvestigationRunResult =
  | { success: true; agentId: string; output: InvestigationAgentOutput }
  | { success: false };

async function runInvestigationsWithTimeout(
  agentExecutions: { id: string; agentId: string; role: AgentRole }[],
  parameters: CompetitorAnalysisParameters,
  templateDefinition: TemplateDefinition,
  deps: EngineRunDeps,
  streamFn: (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string>,
  agentTimeoutMs: number,
  executionSignal: AbortSignal,
): Promise<InvestigationRunResult[]> {
  const results = await Promise.allSettled(
    agentExecutions.map(async (ae) => {
      const def = findDefinition(templateDefinition, ae.agentId);
      if (!def || def.role !== "investigation") {
        return { success: false } as InvestigationRunResult;
      }

      const agentTimeout = timeoutSignalPair(agentTimeoutMs);
      const combinedController = new AbortController();
      const abortCombined = () => combinedController.abort();
      executionSignal.addEventListener("abort", abortCombined);
      agentTimeout.signal.addEventListener("abort", abortCombined);

      const result = await runInvestigationAgent(
        {
          agentExecutionId: ae.id,
          agentId: ae.agentId,
          definition: def,
          parameters,
          llm: templateDefinition.llm,
          signal: combinedController.signal,
        },
        {
          stream: streamFn,
          updateAgentExecution: deps.updateAgentExecution,
          onEvent: deps.onEvent,
        },
      );

      agentTimeout.clear();
      executionSignal.removeEventListener("abort", abortCombined);
      agentTimeout.signal.removeEventListener("abort", abortCombined);

      if (result.success) {
        return {
          success: true,
          agentId: ae.agentId,
          output: result.output,
        } as InvestigationRunResult;
      }
      return { success: false } as InvestigationRunResult;
    }),
  );

  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { success: false },
  );
}
