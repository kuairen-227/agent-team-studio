/**
 * WS でストリーミングされた agent 出力（生 JSON 文字列）を、待機 UI 用に
 * 構造化表示できる形へ寛容にパースする純粋関数。
 *
 * 調査エージェント（investigation_*）のみ構造化対象とする。統合エージェントの
 * マトリクスは ExecutionResultView が REST(=Result.structured SSoT) から描画する
 * ため、ここでは構造化せず unstructured（生 JSON は折りたたみ表示）に倒す。
 *
 * パース失敗時は raw フォールバックする。ブランド軸「判断材料を残す」に従い、
 * 構造化できない出力も生データとしてユーザーに到達させる（brand.md §1）。
 * フェンス除去ロジックは agent-core の parseInvestigationOutput と揃える。
 *
 * SSoT: docs/design/templates/competitor-analysis.md
 */

import type {
  CompetitorPerspectiveKey,
  EvidenceLevel,
  InvestigationAgentOutput,
  InvestigationFinding,
} from "@agent-team-studio/shared";

/** 待機 UI 向けに正規化した agent 出力。 */
export type ParsedAgentOutput =
  | { kind: "investigation"; data: InvestigationAgentOutput }
  | { kind: "unstructured"; raw: string };

// shared はこれらを union 型でのみ公開しランタイム配列を持たないため、
// 検証用に最小の定数を local 定義する（agent-core も同様にローカル保持）。
const PERSPECTIVE_KEYS: readonly CompetitorPerspectiveKey[] = [
  "strategy",
  "product",
  "investment",
  "partnership",
];

const EVIDENCE_LEVELS: readonly EvidenceLevel[] = [
  "strong",
  "moderate",
  "weak",
  "insufficient",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFinding(value: unknown): value is InvestigationFinding {
  if (!isRecord(value)) return false;
  if (typeof value.competitor !== "string") return false;
  if (
    !Array.isArray(value.points) ||
    !value.points.every((p) => typeof p === "string")
  )
    return false;
  if (!EVIDENCE_LEVELS.includes(value.evidence_level as EvidenceLevel))
    return false;
  if (value.notes !== undefined && typeof value.notes !== "string")
    return false;
  return true;
}

function isInvestigationOutput(
  value: unknown,
): value is InvestigationAgentOutput {
  if (!isRecord(value)) return false;
  if (!PERSPECTIVE_KEYS.includes(value.perspective as CompetitorPerspectiveKey))
    return false;
  if (!Array.isArray(value.findings)) return false;
  return value.findings.every(isFinding);
}

/** ```json フェンスを除去して JSON.parse を試みる。失敗時は undefined。 */
function tryParseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*\n?/, "")
    .replace(/\n?```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

/**
 * agentId と生出力から待機 UI 向けの構造化結果を返す。
 * investigation_* かつ shape が妥当な場合のみ investigation を返し、
 * それ以外（統合エージェント・パース失敗・shape 不正）は unstructured に倒す。
 */
export function parseAgentOutput(
  agentId: string,
  output: string,
): ParsedAgentOutput {
  if (agentId.startsWith("investigation_")) {
    const parsed = tryParseJson(output);
    if (isInvestigationOutput(parsed)) {
      return { kind: "investigation", data: parsed };
    }
  }
  return { kind: "unstructured", raw: output };
}
