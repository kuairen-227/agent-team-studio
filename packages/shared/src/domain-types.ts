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
  "internal_error",
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

/** テンプレートの静的定義。 */
export type TemplateDefinition = {
  schema_version: "1";
  input_schema: JsonSchema;
  agents: AgentDefinition[];
  llm: LlmDefaults;
};

/** テンプレートのドメインオブジェクト（data-model.md §3）。 */
export type Template = {
  id: TemplateId;
  name: string;
  description: string;
  definition: TemplateDefinition;
  created_at: string;
  updated_at: string;
};

// ---------- Execution / AgentExecution / Result ----------

/** Execution のドメインオブジェクト（data-model.md §4）。 */
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

/** `AgentExecution` の調査エージェントバリアント。 */
export type InvestigationAgentExecution = AgentExecutionBase<
  "investigation",
  InvestigationAgentOutput
>;

/** `AgentExecution` の統合エージェントバリアント。 */
export type IntegrationAgentExecution = AgentExecutionBase<
  "integration",
  IntegrationAgentOutput
>;

export type AgentExecution =
  | InvestigationAgentExecution
  | IntegrationAgentExecution;

/** 実行結果のドメインオブジェクト（data-model.md §7）。 */
export type Result = {
  id: ResultId;
  execution_id: ExecutionId;
  markdown: string;
  structured: CompetitorAnalysisResult;
  created_at: string;
};

// ---------- 競合調査テンプレート固有の I/O ----------
// SSoT: docs/design/templates/competitor-analysis.md

/** 競合調査における 4 つの分析視点（戦略・製品・投資・提携）を識別するキー。 */
export type CompetitorPerspectiveKey =
  | "strategy"
  | "product"
  | "investment"
  | "partnership";

/** 調査結果の証拠信頼度（strong → moderate → weak → insufficient の 4 段階）。 */
export type EvidenceLevel = "strong" | "moderate" | "weak" | "insufficient";

/**
 * 出典・参照元の由来区分（#226）。確度ラベルと対で提示し、ユーザーの独立検証を支える。
 * 型と検証用ランタイム配列の二重保証を避けるため、SSoT を `as const` 配列に置き
 * `SourceOrigin` を派生させる（`EXECUTION_STATUSES` 等の共通 enum と同方式）。
 * agent-core / web のパースガードはこの配列を参照し origin を検証する。
 * - `knowledge_base`: LLM 知識ベース由来。`detail` に既知の一次情報源（URL / 文献名）。
 * - `reference`: ユーザー提供の参考テキスト由来。`detail` に該当箇所（見出し / 抜粋）。
 * - `web_search`: 実 Web 検索由来（#323 / ADR-0045）。`detail` に取得した実在の出典 URL。
 *   検索失敗・ゼロ件時は本 origin を使わず `knowledge_base` / `estimated` へ縮退し、URL を捏造しない。
 * - `estimated`: 推定。確証なく導いた情報である旨を明示する。
 * - `unknown`: 出典不明。
 */
export const SOURCE_ORIGINS = [
  "knowledge_base",
  "reference",
  "web_search",
  "estimated",
  "unknown",
] as const;

export type SourceOrigin = (typeof SOURCE_ORIGINS)[number];

/** 調査結果セル・所見の出典・参照元（#226）。 */
export type Source = {
  origin: SourceOrigin;
  /** origin に応じた出典の手がかり（KB: URL / 文献名、reference: 見出し / 抜粋）。不明時は省略可。 */
  detail?: string;
};

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

/** Investigation Agent の競合 1 社・1 視点分の発見事項。 */
export type InvestigationFinding = {
  competitor: string;
  points: string[];
  evidence_level: EvidenceLevel;
  notes?: string;
  /** この発見事項の出典・参照元（#226）。LLM が省略しうるため optional。 */
  sources?: Source[];
};

/**
 * Integration Agent の出力 = Result.structured と同型
 * （competitor-analysis.md §Integration Agent 出力）。
 */
export type IntegrationAgentOutput = {
  matrix: PerspectiveMatrixRow[];
  overall_insights: OverallInsight[];
  missing: MissingPerspective[];
};

/** 観点横断の全体所見 1 件と、その根拠となる出典（#226）。 */
export type OverallInsight = {
  text: string;
  /** この所見の出典・参照元。LLM が省略しうるため optional。 */
  sources?: Source[];
};

/** `Result.structured` の型（Integration Agent の出力と同型）。 */
export type CompetitorAnalysisResult = IntegrationAgentOutput;

/** 競合調査マトリクスの 1 行（視点ごとの競合データ）。 */
export type PerspectiveMatrixRow = {
  perspective: CompetitorPerspectiveKey;
  cells: MatrixCell[];
};

/** `PerspectiveMatrixRow` の各競合に対するセル。 */
export type MatrixCell = {
  competitor: string;
  summary: string;
  /** Investigation Agent の evidence_level を転記（agent_failed は含まれない）。 */
  source_evidence_level: EvidenceLevel;
  /** この要約の出典・参照元（#226）。Investigation の sources を集約・転記する。LLM が省略しうるため optional。 */
  sources?: Source[];
};

/** マトリクスから欠落している視点とその理由。 */
export type MissingPerspective = {
  perspective: CompetitorPerspectiveKey;
  reason: "agent_failed" | "insufficient_evidence";
};
