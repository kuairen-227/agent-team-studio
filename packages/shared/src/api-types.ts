/**
 * REST API のリクエスト/レスポンス型。
 *
 * SSoT: docs/design/api-design.md
 * 命名規約は api-design.md §レスポンス形式 の JSON 例に合わせて camelCase。
 * URL/メソッド/ステータスの SSoT は設計 doc 側に残し、本ファイルはペイロードのみを扱う。
 */

import type {
  AgentExecutionId,
  AgentRole,
  AgentStatus,
  CompetitorAnalysisParameters,
  CompetitorAnalysisResult,
  ExecutionId,
  ExecutionStatus,
  IntegrationAgentOutput,
  InvestigationAgentOutput,
  ResultId,
  TemplateDefinition,
  TemplateId,
} from "./domain-types.ts";

// ---------- 共通 ----------

/** 一覧取得時のレスポンス形式（api-design.md §レスポンス形式）。 */
export type ListResponse<T> = {
  items: T[];
  total: number;
};

// ---------- エラー（api-design.md §エラーレスポンス） ----------

/**
 * REST エラーの discriminated union。errorCode で識別する。
 * api-design.md §`errorCode` と HTTP ステータスの対応:
 *   validation_error → 400 / not_found → 404 / internal_error → 500
 */
export type ApiError = ApiValidationError | ApiNotFoundError | ApiInternalError;

export type ApiValidationError = {
  errorCode: "validation_error";
  message: string;
  details: { field: string; reason: string }[];
};

export type ApiNotFoundError = {
  errorCode: "not_found";
  message: string;
  /** resource は MVP リソースに限定したリテラル union（api-design.md 注）。 */
  details: { resource: "template" | "execution"; id: string };
};

export type ApiInternalError = {
  errorCode: "internal_error";
  message: string;
  /** MVP では省略を基本とし、将来のトレース導入余地として traceId を残す。 */
  details?: { traceId?: string };
};

// ---------- GET /api/templates ----------

/** 一覧用の軽量表現（definition は含めない）。 */
export type TemplateSummary = {
  id: TemplateId;
  name: string;
  description: string;
};

export type GetTemplatesResponse = ListResponse<TemplateSummary>;

// ---------- GET /api/templates/:id ----------

export type GetTemplateResponse = {
  id: TemplateId;
  name: string;
  description: string;
  definition: TemplateDefinition;
  createdAt: string;
  updatedAt: string;
};

// ---------- POST /api/executions ----------

export type CreateExecutionRequest = {
  templateId: TemplateId;
  parameters: CompetitorAnalysisParameters;
};

/** 202 Accepted で返す軽量レスポンス（api-design.md §レスポンス形式 例）。 */
export type CreateExecutionResponse = {
  id: ExecutionId;
  status: ExecutionStatus;
  createdAt: string;
};

// ---------- GET /api/executions ----------

export type ExecutionSummary = {
  id: ExecutionId;
  templateId: TemplateId;
  status: ExecutionStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type GetExecutionsResponse = ListResponse<ExecutionSummary>;

// ---------- GET /api/executions/:id ----------

type AgentExecutionDetailBase<R extends AgentRole, O> = {
  id: AgentExecutionId;
  agentId: string;
  role: R;
  status: AgentStatus;
  output?: O;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

export type InvestigationAgentExecutionDetail = AgentExecutionDetailBase<
  "investigation",
  InvestigationAgentOutput
>;

export type IntegrationAgentExecutionDetail = AgentExecutionDetailBase<
  "integration",
  IntegrationAgentOutput
>;

export type AgentExecutionDetail =
  | InvestigationAgentExecutionDetail
  | IntegrationAgentExecutionDetail;

export type ResultDetail = {
  id: ResultId;
  markdown: string;
  structured: CompetitorAnalysisResult;
  createdAt: string;
};

/**
 * Execution 詳細。AgentExecution と Result（任意）を併せて返す。
 * Result の存在条件は data-model.md §3 不変条件 に従う。
 */
export type GetExecutionResponse = {
  id: ExecutionId;
  templateId: TemplateId;
  parameters: CompetitorAnalysisParameters;
  status: ExecutionStatus;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  agentExecutions: AgentExecutionDetail[];
  result?: ResultDetail;
};
