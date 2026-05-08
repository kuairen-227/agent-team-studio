/**
 * Investigation Agent / Integration Agent の実行。
 *
 * 各エージェントは LLM ストリームを受け取り、DB 更新とイベント発行を行う。
 * 副作用は「DB UPDATE → イベント発行」の順序を保証する（agent-execution.md §4）。
 * 依存はすべて AgentDeps で注入するため、テスト時に差し替え可能。
 *
 * SSoT: docs/design/agent-execution.md / docs/design/llm-integration.md
 */

import type {
  AgentFailReason,
  AgentStatus,
  CompetitorAnalysisParameters,
  CompetitorPerspectiveKey,
  EvidenceLevel,
  IntegrationAgentDefinition,
  IntegrationAgentOutput,
  InvestigationAgentDefinition,
  InvestigationAgentOutput,
  LlmDefaults,
  MissingPerspective,
} from "@agent-team-studio/shared";
import type { AgentEvent } from "./events.ts";
import type { LlmInput } from "./llm-client.ts";
import { LlmError } from "./llm-error.ts";

// ---------- 公開型 ----------

/** agent.ts が必要とする外部依存の注入口。テスト時はすべて差し替え可能。 */
export type AgentDeps = {
  stream: (input: LlmInput, signal?: AbortSignal) => AsyncIterable<string>;
  updateAgentExecution: (
    id: string,
    patch: AgentExecutionPatch,
  ) => Promise<void>;
  onEvent: (event: AgentEvent) => void;
};

/** agent_executions テーブルへの書き込みパッチ型。 */
export type AgentExecutionPatch = {
  status: AgentStatus;
  output?: InvestigationAgentOutput | IntegrationAgentOutput;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
};

/** Investigation Agent 実行の入力。 */
export type InvestigationAgentRunInput = {
  agentExecutionId: string;
  agentId: string;
  definition: InvestigationAgentDefinition;
  parameters: CompetitorAnalysisParameters;
  llm: LlmDefaults;
  signal: AbortSignal;
};

/** Integration Agent 実行の入力。 */
export type IntegrationAgentRunInput = {
  agentExecutionId: string;
  agentId: string;
  definition: IntegrationAgentDefinition;
  parameters: CompetitorAnalysisParameters;
  successfulInvestigations: Array<{
    agentId: string;
    output: InvestigationAgentOutput;
  }>;
  llm: LlmDefaults;
  signal: AbortSignal;
};

/** Investigation Agent の実行結果。 */
export type InvestigationResult =
  | { success: true; output: InvestigationAgentOutput }
  | { success: false; reason: AgentFailReason };

/** Integration Agent の実行結果。 */
export type IntegrationResult =
  | { success: true; output: IntegrationAgentOutput; markdown: string }
  | { success: false; reason: AgentFailReason };

// ---------- プロンプト展開 ----------

function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in vars)) throw new Error(`Unknown template key: {{${key}}}`);
    return vars[key] as string;
  });
}

function buildInvestigationSystem(
  template: string,
  def: InvestigationAgentDefinition,
  params: CompetitorAnalysisParameters,
): string {
  return substituteTemplate(template, {
    perspective_key: def.specialization.perspective_key,
    perspective_name_ja: def.specialization.perspective_name_ja,
    perspective_description: def.specialization.perspective_description,
    competitors: params.competitors.join(", "),
    reference_or_empty: params.reference ?? "（参考情報なし）",
  });
}

function buildIntegrationSystem(
  template: string,
  params: CompetitorAnalysisParameters,
  investigations: Array<{ output: InvestigationAgentOutput }>,
): string {
  return substituteTemplate(template, {
    competitors: params.competitors.join(", "),
    investigation_results: JSON.stringify(
      investigations.map((i) => i.output),
      null,
      2,
    ),
    reference_or_empty: params.reference ?? "（参考情報なし）",
  });
}

// ---------- 出力パース ----------

const PERSPECTIVE_KEYS: readonly string[] = [
  "strategy",
  "product",
  "investment",
  "partnership",
] satisfies CompetitorPerspectiveKey[];

const EVIDENCE_LEVELS = [
  "strong",
  "moderate",
  "weak",
  "insufficient",
] as const satisfies EvidenceLevel[];

function isInvestigationOutput(
  value: unknown,
): value is InvestigationAgentOutput {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!PERSPECTIVE_KEYS.includes(obj.perspective as string)) return false;
  if (!Array.isArray(obj.findings)) return false;
  for (const f of obj.findings) {
    if (typeof f !== "object" || f === null) return false;
    const finding = f as Record<string, unknown>;
    if (typeof finding.competitor !== "string") return false;
    if (!Array.isArray(finding.points)) return false;
    if (!EVIDENCE_LEVELS.includes(finding.evidence_level as EvidenceLevel))
      return false;
  }
  return true;
}

const MISSING_REASONS = [
  "agent_failed",
  "insufficient_evidence",
] as const satisfies MissingPerspective["reason"][];

function isIntegrationOutput(value: unknown): value is IntegrationAgentOutput {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (
    !Array.isArray(obj.matrix) ||
    !Array.isArray(obj.overall_insights) ||
    !Array.isArray(obj.missing)
  )
    return false;
  for (const cell of obj.matrix) {
    if (typeof cell !== "object" || cell === null) return false;
    const c = cell as Record<string, unknown>;
    if (
      !PERSPECTIVE_KEYS.includes(c.perspective as string) ||
      !Array.isArray(c.cells)
    )
      return false;
    for (const item of c.cells) {
      if (typeof item !== "object" || item === null) return false;
      const i = item as Record<string, unknown>;
      if (
        typeof i.competitor !== "string" ||
        typeof i.summary !== "string" ||
        !EVIDENCE_LEVELS.includes(i.source_evidence_level as EvidenceLevel)
      )
        return false;
    }
  }
  for (const insight of obj.overall_insights) {
    if (typeof insight !== "string") return false;
  }
  for (const m of obj.missing) {
    if (typeof m !== "object" || m === null) return false;
    const mp = m as Record<string, unknown>;
    if (
      !PERSPECTIVE_KEYS.includes(mp.perspective as string) ||
      !(MISSING_REASONS as readonly string[]).includes(mp.reason as string)
    )
      return false;
  }
  return true;
}

function parseInvestigationOutput(raw: string): InvestigationAgentOutput {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*\n?/, "")
    .replace(/\n?```\s*$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Invalid JSON in investigation output");
  }
  if (!isInvestigationOutput(parsed)) {
    throw new Error("Invalid investigation output structure");
  }
  return parsed;
}

function parseIntegrationOutput(raw: string): {
  markdown: string;
  structured: IntegrationAgentOutput;
} {
  // "matrix" キーの最後の出現から JSON ブロックの開始位置を特定する
  const matrixKeyIdx = raw.lastIndexOf('"matrix"');
  if (matrixKeyIdx === -1)
    throw new Error('No "matrix" field in integration output');

  let jsonStart = matrixKeyIdx - 1;
  while (jsonStart >= 0 && raw[jsonStart] !== "{") jsonStart--;
  if (jsonStart < 0) throw new Error("No opening brace before matrix field");

  // JSON ブロック末尾の ``` フェンスを除くため、最後の } で切り詰める
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonEnd < jsonStart)
    throw new Error("No closing brace in integration output");
  const jsonSlice = raw.slice(jsonStart, jsonEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Invalid JSON in integration output");
  }
  if (!isIntegrationOutput(parsed)) {
    throw new Error("Invalid integration output structure");
  }

  return {
    markdown: raw.slice(0, jsonStart).trim(),
    structured: parsed,
  };
}

// ---------- エラー判定ヘルパー ----------

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function toAgentFailReason(err: unknown): AgentFailReason {
  if (isAbortError(err)) return "timeout";
  if (err instanceof LlmError) return err.failReason;
  return "internal_error";
}

// ---------- エージェント実行 ----------

/**
 * Investigation Agent を実行する。
 *
 * DB 更新 → イベント発行の順序で副作用を起こす。失敗時も同様の順序で `agent_failed` を発行する。
 */
export async function runInvestigationAgent(
  input: InvestigationAgentRunInput,
  deps: AgentDeps,
): Promise<InvestigationResult> {
  const startedAt = new Date();
  await deps.updateAgentExecution(input.agentExecutionId, {
    status: "running",
    startedAt,
  });
  deps.onEvent({
    kind: "agent_started",
    agentId: input.agentId,
    startedAt: startedAt.toISOString(),
  });

  const chunks: string[] = [];

  try {
    const llmInput: LlmInput = {
      model: input.llm.model,
      system: buildInvestigationSystem(
        input.definition.system_prompt_template,
        input.definition,
        input.parameters,
      ),
      user: "指示に従って JSON を出力してください。",
      temperature: input.llm.temperature_by_role.investigation,
      max_tokens: input.llm.max_tokens_by_role.investigation,
    };

    for await (const chunk of deps.stream(llmInput, input.signal)) {
      chunks.push(chunk);
      deps.onEvent({
        kind: "agent_output_chunk",
        agentId: input.agentId,
        chunk,
      });
    }
  } catch (err) {
    return handleAgentFailure(err, input.agentExecutionId, input.agentId, deps);
  }

  let output: InvestigationAgentOutput;
  try {
    output = parseInvestigationOutput(chunks.join(""));
  } catch {
    return handleParseFailure(input.agentExecutionId, input.agentId, deps);
  }

  const completedAt = new Date();
  await deps.updateAgentExecution(input.agentExecutionId, {
    status: "completed",
    output,
    completedAt,
  });
  deps.onEvent({
    kind: "agent_completed",
    agentId: input.agentId,
    completedAt: completedAt.toISOString(),
  });
  return { success: true, output };
}

/**
 * Integration Agent を実行する。
 *
 * 出力は Markdown と構造化 JSON の両方を返す。
 */
export async function runIntegrationAgent(
  input: IntegrationAgentRunInput,
  deps: AgentDeps,
): Promise<IntegrationResult> {
  const startedAt = new Date();
  await deps.updateAgentExecution(input.agentExecutionId, {
    status: "running",
    startedAt,
  });
  deps.onEvent({
    kind: "agent_started",
    agentId: input.agentId,
    startedAt: startedAt.toISOString(),
  });

  const chunks: string[] = [];

  try {
    const llmInput: LlmInput = {
      model: input.llm.model,
      system: buildIntegrationSystem(
        input.definition.system_prompt_template,
        input.parameters,
        input.successfulInvestigations,
      ),
      user: "指示に従って Markdown レポートと内部 JSON を出力してください。",
      temperature: input.llm.temperature_by_role.integration,
      max_tokens: input.llm.max_tokens_by_role.integration,
    };

    for await (const chunk of deps.stream(llmInput, input.signal)) {
      chunks.push(chunk);
      deps.onEvent({
        kind: "agent_output_chunk",
        agentId: input.agentId,
        chunk,
      });
    }
  } catch (err) {
    return handleAgentFailure(err, input.agentExecutionId, input.agentId, deps);
  }

  let markdown: string;
  let structured: IntegrationAgentOutput;
  try {
    const parsed = parseIntegrationOutput(chunks.join(""));
    markdown = parsed.markdown;
    structured = parsed.structured;
  } catch {
    return handleParseFailure(input.agentExecutionId, input.agentId, deps);
  }

  const completedAt = new Date();
  await deps.updateAgentExecution(input.agentExecutionId, {
    status: "completed",
    output: structured,
    completedAt,
  });
  deps.onEvent({
    kind: "agent_completed",
    agentId: input.agentId,
    completedAt: completedAt.toISOString(),
  });
  return { success: true, output: structured, markdown };
}

// ---------- 共通失敗処理 ----------

async function handleAgentFailure(
  err: unknown,
  agentExecutionId: string,
  agentId: string,
  deps: AgentDeps,
): Promise<{ success: false; reason: AgentFailReason }> {
  const completedAt = new Date();
  const reason = toAgentFailReason(err);
  await deps.updateAgentExecution(agentExecutionId, {
    status: "failed",
    errorMessage: err instanceof Error ? err.message : String(err),
    completedAt,
  });
  deps.onEvent({
    kind: "agent_failed",
    agentId,
    reason,
    failedAt: completedAt.toISOString(),
  });
  return { success: false, reason };
}

async function handleParseFailure(
  agentExecutionId: string,
  agentId: string,
  deps: AgentDeps,
): Promise<{ success: false; reason: "output_parse_error" }> {
  const completedAt = new Date();
  await deps.updateAgentExecution(agentExecutionId, {
    status: "failed",
    errorMessage: "output_parse_error",
    completedAt,
  });
  deps.onEvent({
    kind: "agent_failed",
    agentId,
    reason: "output_parse_error",
    failedAt: completedAt.toISOString(),
  });
  return { success: false, reason: "output_parse_error" };
}
