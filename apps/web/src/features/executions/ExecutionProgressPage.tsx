/**
 * US-3 進捗画面 + US-4 結果画面を兼ねた `/executions/:executionId` ページ。
 *
 * WS 接続状態に応じて:
 * - connecting: 接続中テキスト
 * - running: エージェントごとのステータスバッジ + 出力ストリーミング
 * - completed: 結果閲覧（GET /api/executions/:id へリダイレクト）
 * - failed: 失敗メッセージ
 * - error: WS エラー Alert + 履歴一覧への導線
 *
 * US-4 の結果表示（マトリクス・エクスポート）は completed 遷移後に
 * ExecutionResultPage で担う（#120 で実装）。本 Issue では completed 後の
 * リダイレクト or 簡易メッセージを置く。
 */

import type { ExecutionFailReason } from "@agent-team-studio/shared";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AgentState, useExecutionWs } from "./hooks/useExecutionWs";

const Route = getRouteApi("/executions/$executionId");

const AGENT_LABEL: Record<string, string> = {
  investigation_strategy: "戦略調査",
  investigation_product: "製品調査",
  investigation_investment: "投資調査",
  investigation_partnership: "提携調査",
  integration: "統合",
};

const REASON_MESSAGES: Record<ExecutionFailReason, string> = {
  all_investigations_failed: "すべての調査エージェントが失敗しました。",
  integration_failed: "統合エージェントが失敗しました。",
  timeout: "実行がタイムアウトしました。",
  internal_error: "内部エラーが発生しました。",
};

function getAgentLabel(agentId: string): string {
  return AGENT_LABEL[agentId] ?? agentId;
}

export function ExecutionProgressPage() {
  const { executionId } = Route.useParams();
  const wsState = useExecutionWs(executionId);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: フェーズ変化を effect のトリガーとして使用する
  useEffect(() => {
    h1Ref.current?.focus();
  }, [wsState.phase]);

  if (wsState.phase === "connecting") {
    return (
      <section>
        <h1 ref={h1Ref} tabIndex={-1} className="mb-4 text-xl font-semibold">
          接続中
        </h1>
      </section>
    );
  }

  if (wsState.phase === "error") {
    const message =
      wsState.code === 4404
        ? "指定された実行が見つかりません。"
        : "サーバーとの接続でエラーが発生しました。";
    return (
      <section>
        <h1 ref={h1Ref} tabIndex={-1} className="mb-4 text-xl font-semibold">
          接続エラー
        </h1>
        <Alert variant="destructive">
          <AlertTitle>接続エラー</AlertTitle>
          <AlertDescription>
            <p>{message}</p>
            <p className="mt-1">
              履歴一覧（準備中）から過去の実行を確認できます。
            </p>
          </AlertDescription>
        </Alert>
        {wsState.agents.size > 0 && (
          <AgentList agents={[...wsState.agents.values()]} />
        )}
      </section>
    );
  }

  const agents = [...wsState.agents.values()];

  if (wsState.phase === "completed") {
    return (
      <section>
        <h1 ref={h1Ref} tabIndex={-1} className="mb-4 text-xl font-semibold">
          実行完了
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          すべてのエージェントが完了しました。
        </p>
        <AgentList agents={agents} />
        <div className="mt-6">
          <Button variant="outline" disabled>
            結果を表示（準備中）
          </Button>
        </div>
      </section>
    );
  }

  if (wsState.phase === "failed") {
    return (
      <section>
        <h1 ref={h1Ref} tabIndex={-1} className="mb-4 text-xl font-semibold">
          実行失敗
        </h1>
        <Alert variant="destructive">
          <AlertTitle>実行失敗</AlertTitle>
          <AlertDescription>
            <p>{REASON_MESSAGES[wsState.reason]}</p>
            <p className="mt-1">
              履歴一覧（準備中）から過去の実行を確認できます。
            </p>
          </AlertDescription>
        </Alert>
        <AgentList agents={agents} />
      </section>
    );
  }

  // running
  return (
    <section>
      <h1 ref={h1Ref} tabIndex={-1} className="mb-4 text-xl font-semibold">
        実行中
      </h1>
      <AgentList agents={agents} />
    </section>
  );
}

function AgentList({ agents }: { agents: AgentState[] }) {
  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        エージェントの応答を待機しています…
      </p>
    );
  }

  return (
    <ul className="space-y-4" aria-label="エージェント一覧">
      {agents.map((agent) => (
        <li key={agent.agentId}>
          <AgentCard agent={agent} />
        </li>
      ))}
    </ul>
  );
}

function AgentCard({ agent }: { agent: AgentState }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle className="text-base">
          {getAgentLabel(agent.agentId)}
        </CardTitle>
        <Badge variant={agent.status} />
      </CardHeader>
      <CardContent>
        {agent.failReason && (
          <p className="mb-2 text-xs text-destructive">
            失敗理由: {agent.failReason}
          </p>
        )}
        {/* aria-live は DOM に常時存在させることで ARIA 仕様を満たす。 */}
        <div aria-live="polite">
          {agent.output && (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {agent.output}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
