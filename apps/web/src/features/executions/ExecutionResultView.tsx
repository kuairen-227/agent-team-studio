/**
 * 実行結果表示コンポーネント（US-4）。
 *
 * GET /api/executions/:id を SSoT として結果マトリクス・エクスポートを提供する。
 * このコンポーネント自体は result の有無で表示を切り替えるのみで、
 * integration_failed 時の調査エージェント出力表示は呼び出し元が
 * InvestigationOutputsView を並置することで対応する。
 */

import type {
  GetExecutionResponse,
  InvestigationAgentExecutionDetail,
  MissingPerspective,
  OverallInsight,
  PerspectiveMatrixRow,
} from "@agent-team-studio/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/api";
import {
  ALL_PERSPECTIVES,
  EVIDENCE_LEVEL_LABEL,
  InvestigationFindings,
  MISSING_REASON_LABEL,
  PERSPECTIVE_NAME,
  RawDisclosure,
  RawPre,
  SourceList,
} from "./components/structured";

// --- 公開コンポーネント ---

/**
 * 完了済み実行の結果を表示する。
 * WS で execution:completed を受信した後にマウントし、API から詳細を取得する。
 */
export function ExecutionResultView({ executionId }: { executionId: string }) {
  const { data, status, refetch, isFetching } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () =>
      fetchJson<GetExecutionResponse>(`/api/executions/${executionId}`),
  });

  if (status === "pending") {
    return <ResultSkeleton />;
  }

  if (status === "error") {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertTitle>結果の取得に失敗しました</AlertTitle>
        <AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            再読み込み
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (data.result) {
    return <CompletedResultView execution={data} />;
  }

  // completed フェーズで result なしは理論上到達しない（WS 設計上 result 存在が保証される）。
  // 万一発生した場合の安全網として導線を提供する。
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTitle>結果データを取得できませんでした</AlertTitle>
      <AlertDescription>
        <Link to="/" className="underline">
          テンプレート一覧へ
        </Link>
      </AlertDescription>
    </Alert>
  );
}

/**
 * 統合エージェント失敗時（Result 未作成）に調査エージェントの出力を表示する。
 * このコンポーネントは失敗 UI の補足表示として使われるため、fetch 失敗・ロード中は
 * 無音で何も描画しない（主要な失敗メッセージは呼び出し元が担う）。
 */
export function InvestigationOutputsView({
  executionId,
}: {
  executionId: string;
}) {
  const { data, status } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () =>
      fetchJson<GetExecutionResponse>(`/api/executions/${executionId}`),
  });

  // fetch 失敗・ロード中は呼び出し元の失敗 UI のみを表示する（意図的なサイレント処理）。
  if (status !== "success") return null;

  const withOutput = data.agentExecutions.filter(
    (ae): ae is InvestigationAgentExecutionDetail =>
      ae.role === "investigation" && ae.output != null,
  );

  if (withOutput.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          各エージェントの調査結果（統合前）
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          統合エージェントが失敗したため、各調査エージェントの出力を表示しています。
        </p>
      </div>
      {withOutput.map((ae) => (
        <InvestigationOutputCard key={ae.id} ae={ae} />
      ))}
    </div>
  );
}

// --- 内部コンポーネント ---

function CompletedResultView({
  execution,
}: {
  execution: GetExecutionResponse;
}) {
  const { result, parameters } = execution;
  if (!result) return null;

  const { structured, markdown } = result;
  const competitors = parameters.competitors;

  return (
    <div className="mt-6 space-y-8">
      <ResultMatrix
        matrix={structured.matrix}
        missing={structured.missing}
        competitors={competitors}
      />
      {structured.missing.length > 0 && (
        <MissingPerspectivesSection missing={structured.missing} />
      )}
      {structured.overall_insights.length > 0 && (
        <OverallInsights insights={structured.overall_insights} />
      )}
      <RawDisclosure summary="結果の内部データ（JSON）を表示">
        <RawPre text={JSON.stringify(structured, null, 2)} />
      </RawDisclosure>
      <ExportActions markdown={markdown} executionId={execution.id} />
    </div>
  );
}

function ResultMatrix({
  matrix,
  missing,
  competitors,
}: {
  matrix: PerspectiveMatrixRow[];
  missing: MissingPerspective[];
  competitors: string[];
}) {
  const missingSet = new Set(missing.map((m) => m.perspective));

  const perspectives = ALL_PERSPECTIVES.filter(
    (p) => matrix.some((r) => r.perspective === p) || missingSet.has(p),
  );

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">結果マトリクス</h2>
      {perspectives.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          結果データがありません。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="p-2 text-left font-medium">
                  観点
                </th>
                {competitors.map((c) => (
                  <th scope="col" key={c} className="p-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perspectives.map((perspective) => {
                const row = matrix.find((r) => r.perspective === perspective);
                const isMissing = missingSet.has(perspective);

                return (
                  <tr key={perspective} className="border-b last:border-b-0">
                    <th
                      scope="row"
                      className="p-2 text-left font-medium text-muted-foreground"
                    >
                      {PERSPECTIVE_NAME[perspective]}
                    </th>
                    {competitors.map((competitor) => {
                      if (isMissing || !row) {
                        return (
                          <td key={competitor} className="p-2">
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              未取得
                            </span>
                          </td>
                        );
                      }
                      const cell = row.cells.find(
                        (c) => c.competitor === competitor,
                      );
                      if (!cell) {
                        return (
                          <td
                            key={competitor}
                            className="p-2 text-muted-foreground"
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={competitor} className="p-2 align-top">
                          <p className="leading-relaxed">{cell.summary}</p>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            確度:{" "}
                            {EVIDENCE_LEVEL_LABEL[cell.source_evidence_level]}
                          </span>
                          <SourceList sources={cell.sources} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverallInsights({ insights }: { insights: OverallInsight[] }) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">総合インサイト</h2>
      <ul className="space-y-2">
        {insights.map((insight, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: サーバー生成の固定リスト
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
            {/* SourceList が <p>/<ul>（ブロック要素）を返すため、インライン <span> ではなく
                <div> で包む。<span> 直下にブロック要素を置くと HTML 仕様違反となり
                React のハイドレーション不一致やレイアウト崩壊を招く（#226 レビュー指摘）。 */}
            <div>
              {insight.text}
              <SourceList sources={insight.sources} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MissingPerspectivesSection({
  missing,
}: {
  missing: MissingPerspective[];
}) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">未取得観点</h2>
      <ul className="space-y-1 text-sm">
        {missing.map((m) => (
          <li key={m.perspective} className="flex gap-2">
            <span className="font-medium">
              {PERSPECTIVE_NAME[m.perspective]}
            </span>
            <span className="text-muted-foreground">
              — {MISSING_REASON_LABEL[m.reason]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ActionState = "idle" | "success" | "error";

function ExportActions({
  markdown,
  executionId,
}: {
  markdown: string;
  executionId: string;
}) {
  const [copyState, setCopyState] = useState<ActionState>("idle");
  const [downloadState, setDownloadState] = useState<ActionState>("idle");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState("success");
    } catch {
      setCopyState("error");
    } finally {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `competitive-analysis-${executionId}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadState("success");
    } catch {
      setDownloadState("error");
    } finally {
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
      downloadTimerRef.current = setTimeout(
        () => setDownloadState("idle"),
        2000,
      );
    }
  };

  const copyLabel =
    copyState === "success"
      ? "コピーしました"
      : copyState === "error"
        ? "コピーに失敗しました"
        : "Markdown をコピー";

  const downloadLabel =
    downloadState === "success"
      ? "ダウンロードしました"
      : downloadState === "error"
        ? "ダウンロードに失敗しました"
        : "ダウンロード";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={copyState !== "idle"}
        >
          {copyLabel}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={downloadState !== "idle"}
        >
          {downloadLabel}
        </Button>
      </div>
      {/* スクリーンリーダーへの操作結果通知（コピーとDLを独立させ同時読み上げ競合を防ぐ） */}
      <span aria-live="polite" className="sr-only">
        {copyState === "success" && "コピーしました"}
        {copyState === "error" && "コピーに失敗しました"}
      </span>
      <span aria-live="polite" className="sr-only">
        {downloadState === "success" && "ダウンロードしました"}
        {downloadState === "error" && "ダウンロードに失敗しました"}
      </span>
    </div>
  );
}

function InvestigationOutputCard({
  ae,
}: {
  ae: InvestigationAgentExecutionDetail;
}) {
  // 呼び出し元フィルタで output != null が保証済み。防衛的ガードとして残す。
  if (!ae.output) return null;
  const { perspective, findings } = ae.output;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {PERSPECTIVE_NAME[perspective] ?? perspective}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <InvestigationFindings findings={findings} />
      </CardContent>
    </Card>
  );
}

function ResultSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
