/**
 * 競合調査の構造化結果を描画する共有プレゼンテーション部品とラベル定数。
 *
 * 進捗画面（待機中の完了 agent カード）と結果画面（ExecutionResultView）の
 * 双方から再利用し、findings 描画・ラベル変換・生データ折りたたみの重複を防ぐ。
 * データ取得は持たず、渡された値を描画するのみ（Result.structured を SSoT とする
 * ui-patterns.md §2.7 の方針に従う）。
 *
 * SSoT: docs/design/templates/competitor-analysis.md
 */

import type {
  CompetitorPerspectiveKey,
  EvidenceLevel,
  InvestigationFinding,
  MissingPerspective,
} from "@agent-team-studio/shared";
import type { ReactNode } from "react";

export const ALL_PERSPECTIVES: readonly CompetitorPerspectiveKey[] = [
  "strategy",
  "product",
  "investment",
  "partnership",
];

export const PERSPECTIVE_NAME: Record<CompetitorPerspectiveKey, string> = {
  strategy: "戦略",
  product: "製品",
  investment: "投資",
  partnership: "パートナーシップ",
};

export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  strong: "強",
  moderate: "中",
  weak: "弱",
  insufficient: "不足",
};

export const MISSING_REASON_LABEL: Record<
  MissingPerspective["reason"],
  string
> = {
  agent_failed: "エージェント失敗",
  insufficient_evidence: "証拠不足",
};

/** 競合 1 社分の発見事項（要点リスト + 補足）。 */
function FindingBlock({ finding }: { finding: InvestigationFinding }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <p className="mb-1 text-sm font-medium">{finding.competitor}</p>
      <ul className="space-y-1">
        {finding.points.map((point, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: サーバー生成の固定リスト
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {finding.notes && (
        <p className="mt-1 text-xs text-muted-foreground">{finding.notes}</p>
      )}
    </div>
  );
}

/** 調査エージェント出力の findings 群を縦積みで描画する（Card 枠は持たない）。 */
export function InvestigationFindings({
  findings,
}: {
  findings: InvestigationFinding[];
}) {
  return (
    <div className="space-y-4">
      {findings.map((finding, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: サーバー生成の固定リスト
        <FindingBlock key={i} finding={finding} />
      ))}
    </div>
  );
}

/**
 * 生データ（生テキスト / 内部 JSON）を既定で折りたたんで提示する disclosure。
 *
 * ブランド軸「判断材料を残す」に従い生データを捨てず、待機時の視覚的負荷
 * （#227 の離脱衝動）を下げるため既定で閉じる。ネイティブ details/summary で
 * キーボード操作・スクリーンリーダーに対応する（追加依存なし）。
 */
export function RawDisclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="mt-2 text-sm">
      <summary className="cursor-pointer rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {summary}
      </summary>
      {children}
    </details>
  );
}

/** 生テキスト / JSON を等幅 pre で表示する（disclosure の中身として使う）。 */
export function RawPre({ text }: { text: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed">
      {text}
    </pre>
  );
}
