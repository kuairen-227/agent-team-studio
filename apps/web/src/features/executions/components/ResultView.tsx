/**
 * 統合結果表示コンポーネント（US-4）。
 *
 * ui-patterns.md §3.4 partial-failure・§5 コンポーネントマッピングに準拠:
 * - 結果マトリクス: 素の <table> + Tailwind（行 = 観点、列 = 競合）
 * - 失敗観点の行は除外せず「missing」ラベルで空セルを表示
 * - マトリクス下部に「未取得観点」セクション
 * - Markdown コピー / ダウンロード（result.markdown を SSoT とする）
 */

import type {
  CompetitorAnalysisResult,
  CompetitorPerspectiveKey,
  GetExecutionResponse,
  InvestigationAgentExecutionDetail,
  MissingPerspective,
} from "@agent-team-studio/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALL_PERSPECTIVES: CompetitorPerspectiveKey[] = [
  "strategy",
  "product",
  "investment",
  "partnership",
];

const PERSPECTIVE_NAMES: Record<CompetitorPerspectiveKey, string> = {
  strategy: "戦略",
  product: "製品",
  investment: "投資",
  partnership: "提携",
};

const MISSING_REASON_LABELS: Record<string, string> = {
  agent_failed: "エージェント失敗",
  insufficient_evidence: "情報不足",
};

type Props = {
  execution: GetExecutionResponse;
};

export function ResultView({ execution }: Props) {
  const { result, agentExecutions, parameters, errorMessage } = execution;
  const competitors = parameters.competitors;

  // 統合エージェント失敗: Result なし → 個別エージェント出力をカード表示
  if (!result && errorMessage === "integration_failed") {
    const investigationAgents = agentExecutions.filter(
      (ae): ae is InvestigationAgentExecutionDetail =>
        ae.role === "investigation" && !!ae.output,
    );
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          統合エージェントが失敗したため、個別エージェントの出力を表示します。
        </p>
        {investigationAgents.map((ae) => (
          <Card key={ae.agentId}>
            <CardHeader>
              <CardTitle className="text-sm">{ae.agentId}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {JSON.stringify(ae.output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
        {investigationAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            利用可能なエージェント出力がありません。
          </p>
        )}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <MatrixSection structured={result.structured} competitors={competitors} />
      {result.structured.overall_insights.length > 0 && (
        <InsightsSection insights={result.structured.overall_insights} />
      )}
      {result.structured.missing.length > 0 && (
        <MissingSection missing={result.structured.missing} />
      )}
      <ExportSection markdown={result.markdown} executionId={execution.id} />
    </div>
  );
}

function MatrixSection({
  structured,
  competitors,
}: {
  structured: CompetitorAnalysisResult;
  competitors: string[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">調査結果マトリクス</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
                観点
              </th>
              {competitors.map((c) => (
                <th
                  key={c}
                  className="border border-border bg-muted px-3 py-2 text-left font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERSPECTIVES.map((perspective) => {
              const matrixRow = structured.matrix.find(
                (r) => r.perspective === perspective,
              );
              const isMissing = !matrixRow;

              return (
                <tr key={perspective}>
                  <td className="border border-border px-3 py-2 font-medium">
                    {PERSPECTIVE_NAMES[perspective]}
                  </td>
                  {competitors.map((competitor) => {
                    if (isMissing) {
                      return (
                        <td
                          key={competitor}
                          className="border border-border px-3 py-2 text-muted-foreground"
                        >
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            missing
                          </span>
                        </td>
                      );
                    }
                    const cell = matrixRow.cells.find(
                      (cl) => cl.competitor === competitor,
                    );
                    return (
                      <td
                        key={competitor}
                        className="border border-border px-3 py-2"
                      >
                        {cell ? (
                          <span>{cell.summary}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InsightsSection({ insights }: { insights: string[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">総合インサイト</h2>
      <ul className="space-y-2 text-sm">
        {insights.map((insight, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: インサイトは順序固定で並び替えなし
          <li key={i} className="flex gap-2">
            <span className="mt-1 shrink-0 text-muted-foreground">•</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MissingSection({ missing }: { missing: MissingPerspective[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">未取得観点</h2>
      <ul className="space-y-1 text-sm">
        {missing.map((m) => (
          <li key={m.perspective} className="flex gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">
              {PERSPECTIVE_NAMES[m.perspective]}
            </span>
            <span>—</span>
            <span>{MISSING_REASON_LABELS[m.reason] ?? m.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExportSection({
  markdown,
  executionId,
}: {
  markdown: string;
  executionId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `result-${executionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">エクスポート</h2>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? "コピーしました" : "Markdown をコピー"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          Markdown をダウンロード
        </Button>
      </div>
    </section>
  );
}
