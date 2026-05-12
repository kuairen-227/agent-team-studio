/**
 * US-3 進捗画面 + US-4 結果画面を兼ねた `/executions/:executionId` ページ。
 *
 * WS 接続状態に応じて:
 * - connecting: 接続中テキスト
 * - running: エージェントごとのステータスバッジ + 出力ストリーミング
 * - completed: 結果マトリクス + エクスポート（GET /api/executions/:id が SSoT）
 * - failed: 失敗メッセージ。integration_failed の場合は調査エージェント出力も表示
 * - error: WS エラー Alert + 履歴一覧への導線
 */

import type {
  AgentFailReason,
  ExecutionFailReason,
} from "@agent-team-studio/shared";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ExecutionResultView,
  InvestigationOutputsView,
} from "./ExecutionResultView";
import { type AgentState, useExecutionWs } from "./hooks/useExecutionWs";

const Route = getRouteApi("/executions/$executionId");

const AGENT_LABEL: Record<string, string> = {
  investigation_strategy: "戦略調査",
  investigation_product: "製品調査",
  investigation_investment: "投資調査",
  investigation_partnership: "提携調査",
  integration: "統合",
};

const AGENT_FAIL_REASON_MESSAGES: Record<AgentFailReason, string> = {
  llm_error: "LLM エラー",
  output_parse_error: "出力解析エラー",
  timeout: "タイムアウト",
  internal_error: "内部エラー",
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
          接続中…
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
          <AlertTitle>WebSocket 接続に失敗しました</AlertTitle>
          <AlertDescription>
            <p>{message}</p>
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
        <AgentList agents={agents} />
        <ExecutionResultView executionId={executionId} />
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
          <AlertTitle>{REASON_MESSAGES[wsState.reason]}</AlertTitle>
        </Alert>
        <AgentList agents={agents} />
        {wsState.reason === "integration_failed" && (
          <InvestigationOutputsView executionId={executionId} />
        )}
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
        {agent.failReason && (
          <span className="text-xs text-destructive">
            {AGENT_FAIL_REASON_MESSAGES[agent.failReason]}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {/* aria-live は DOM に常時存在させることで ARIA 仕様を満たす。 */}
        <div aria-live="polite">
          {agent.failReason && (
            <span className="sr-only">
              失敗理由: {AGENT_FAIL_REASON_MESSAGES[agent.failReason]}
            </span>
          )}
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
