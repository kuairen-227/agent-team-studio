/**
 * ドメインモデルの型定義。
 *
 * SSoT: docs/design/data-model.md / docs/design/templates/competitor-analysis.md
 * 命名規約は data-model.md §6 の TS 例に合わせて snake_case を採用する。
 * REST/WS 境界での camelCase は api-types.ts / ws-types.ts 側で定義する。
 *
 * 本ファイルは TS 型と DB CHECK 制約値の双方の SSoT を兼ねる
 * （`as const` 配列の運用方針は「共通 enum」セクションを参照）。
 */

// ---------- 識別子 ----------
// MVP では string のまま。branded type 化は将来検討（api-design.md §エラーレスポンス 注）。

export type TemplateId = string;
export type ExecutionId = string;
export type AgentExecutionId = string;
export type ResultId = string;

// ---------- 共通 enum ----------

// SSoT として `as const` 配列を置き、TS union 型と DB schema 用の値配列の双方を
// ここから派生させる。`packages/db` の schema は同配列を import して
// `text("col", { enum })` と CHECK 制約 SQL の双方を構築する。
//
// `EXECUTION_STATUSES` と `AGENT_STATUSES` は MVP 時点では値が完全一致するが、
// ADR-0014 §中立で Execution 側のみ `partial_failure` 追加が示唆されているため
// 分離維持する（Issue #97 の方針）。

/** Execution.status の取りうる値（data-model.md §5）。 */
export const EXECUTION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

/** AgentExecution.status の取りうる値（data-model.md §5）。 */
export const AGENT_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

/** AgentExecution.role の取りうる値（data-model.md §4.3）。 */
export const AGENT_ROLES = ["investigation", "integration"] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentRole = (typeof AGENT_ROLES)[number];

/** 個別エージェントの失敗理由（agent-execution.md §5）。 */
export const AGENT_FAIL_REASONS = [
  "llm_error",
  "output_parse_error",
  "timeout",
  "internal_error",
] as const;

/** Execution 全体の失敗理由（agent-execution.md §5）。 */
export const EXECUTION_FAIL_REASONS = [
  "all_investigations_failed",
  "integration_failed",
  "timeout",
] as const;

export type AgentFailReason = (typeof AGENT_FAIL_REASONS)[number];
export type ExecutionFailReason = (typeof EXECUTION_FAIL_REASONS)[number];

// ---------- Template ----------

/**
 * Template.definition.input_schema の格納形式。
 * JSON Schema を生のまま保持するため、本パッケージでは構造を強制しない。
 */
export type JsonSchema = Record<string, unknown>;

/** LLM 既定値（data-model.md §6 / llm-integration.md が値の SSoT）。 */
export type LlmDefaults = {
  model: string;
  temperature_by_role: { investigation: number; integration: number };
  max_tokens_by_role: { investigation: number; integration: number };
};

/** Investigation Agent の静的定義（data-model.md §6）。 */
export type InvestigationAgentDefinition = {
  role: "investigation";
  agent_id: string;
  specialization: {
    perspective_key: string;
    perspective_name_ja: string;
    perspective_description: string;
  };
  system_prompt_template: string;
};

/** Integration Agent の静的定義（data-model.md §6）。 */
export type IntegrationAgentDefinition = {
  role: "integration";
  agent_id: string;
  system_prompt_template: string;
};

/** テンプレート定義（agents は Investigation / Integration の混在）。 */
export type AgentDefinition =
  | InvestigationAgentDefinition
  | IntegrationAgentDefinition;

export type TemplateDefinition = {
  schema_version: "1";
  input_schema: JsonSchema;
  agents: AgentDefinition[];
  llm: LlmDefaults;
};

export type Template = {
  id: TemplateId;
  name: string;
  description: string;
  definition: TemplateDefinition;
  created_at: string;
  updated_at: string;
};

// ---------- Execution / AgentExecution / Result ----------

export type Execution = {
  id: ExecutionId;
  template_id: TemplateId;
  /**
   * MVP はシードテンプレート（競合調査）1 件のみ（ADR-0005）のため、
   * テンプレート固有型に直接依存させる。複数テンプレート対応時に
   * generic 化または unknown + Zod バリデーションに切り替える。
   */
  parameters: CompetitorAnalysisParameters;
  status: ExecutionStatus;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
};

/**
 * AgentExecution は role により output 型が異なる discriminated union
 * （data-model.md §8）。共通プロパティを generic で抽出する。
 */
type AgentExecutionBase<R extends AgentRole, O> = {
  id: AgentExecutionId;
  execution_id: ExecutionId;
  agent_id: string;
  role: R;
  status: AgentStatus;
  output?: O;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
};

export type InvestigationAgentExecution = AgentExecutionBase<
  "investigation",
  InvestigationAgentOutput
>;

export type IntegrationAgentExecution = AgentExecutionBase<
  "integration",
  IntegrationAgentOutput
>;

export type AgentExecution =
  | InvestigationAgentExecution
  | IntegrationAgentExecution;

export type Result = {
  id: ResultId;
  execution_id: ExecutionId;
  markdown: string;
  structured: CompetitorAnalysisResult;
  created_at: string;
};

// ---------- 競合調査テンプレート固有の I/O ----------
// SSoT: docs/design/templates/competitor-analysis.md

export type CompetitorPerspectiveKey =
  | "strategy"
  | "product"
  | "investment"
  | "partnership";

export type EvidenceLevel = "strong" | "moderate" | "weak" | "insufficient";

/** Execution.parameters（competitor-analysis.md §入力パラメータ JSON Schema）。 */
export type CompetitorAnalysisParameters = {
  competitors: string[];
  reference?: string;
};

/** Investigation Agent の出力（competitor-analysis.md §Investigation Agent 出力）。 */
export type InvestigationAgentOutput = {
  perspective: CompetitorPerspectiveKey;
  findings: InvestigationFinding[];
};

export type InvestigationFinding = {
  competitor: string;
  points: string[];
  evidence_level: EvidenceLevel;
  notes?: string;
};

/**
 * Integration Agent の出力 = Result.structured と同型
 * （competitor-analysis.md §Integration Agent 出力）。
 */
export type IntegrationAgentOutput = {
  matrix: PerspectiveMatrixRow[];
  overall_insights: string[];
  missing: MissingPerspective[];
};

export type CompetitorAnalysisResult = IntegrationAgentOutput;

export type PerspectiveMatrixRow = {
  perspective: CompetitorPerspectiveKey;
  cells: MatrixCell[];
};

export type MatrixCell = {
  competitor: string;
  summary: string;
  /** Investigation Agent の evidence_level を転記（agent_failed は含まれない）。 */
  source_evidence_level: EvidenceLevel;
};

export type MissingPerspective = {
  perspective: CompetitorPerspectiveKey;
  reason: "agent_failed" | "insufficient_evidence";
};
