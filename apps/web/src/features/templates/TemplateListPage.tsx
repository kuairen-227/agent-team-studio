/**
 * テンプレート一覧画面（[US-1](docs/product/user-stories.md#us-1-テンプレートを選んで調査を始める)）。
 *
 * 一覧 fetch（`GET /api/templates`）に加え、各テンプレートのエージェント構成を
 * 表示するため詳細 fetch（`GET /api/templates/:id`）を行う。MVP は 1 テンプレート
 * 前提（ADR-0005）のため N+1 を許容する。テンプレート数が増えた段階で
 * `TemplateSummary` 拡張または専用の集約エンドポイントで再考する。
 *
 * fetch ロジックは Router 固有 API（loader）に寄せず素 `fetch` + `useEffect`
 * とする方針（[ADR-0025](docs/adr/0025-spa-routing-library.md) Decision）。
 * StrictMode 下で useEffect が二度実行される件は cancellation フラグで対処する。
 */

import type {
  AgentDefinition,
  GetTemplateResponse,
  GetTemplatesResponse,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type EnrichedTemplate = TemplateSummary & { agents: AgentDefinition[] };

type State =
  | { kind: "loading" }
  | { kind: "ready"; items: EnrichedTemplate[] }
  | { kind: "error" };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status=${res.status}`);
  return (await res.json()) as T;
}

async function loadTemplates(): Promise<EnrichedTemplate[]> {
  const list = await fetchJson<GetTemplatesResponse>("/api/templates");
  return Promise.all(
    list.items.map(async (summary) => {
      const detail = await fetchJson<GetTemplateResponse>(
        `/api/templates/${summary.id}`,
      );
      return { ...summary, agents: detail.definition.agents };
    }),
  );
}

export function TemplateListPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const navigate = useNavigate();
  // ui-patterns.md §7 / WCAG 2.1 SC 2.4.3: 画面遷移直後は <h1> に focus。
  // tabIndex={-1} でプログラムからのみ focus 可能とし、tab 順には載せない。
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 再読み込み時の race condition 対策。発行ごとに token を更新し、
  // 戻ってきた fetch の token と現在値を比較して古いレスポンスを破棄する。
  const reloadTokenRef = useRef(0);

  const load = useCallback(() => {
    const token = ++reloadTokenRef.current;
    setState({ kind: "loading" });
    loadTemplates()
      .then((items) => {
        if (reloadTokenRef.current === token) {
          setState({ kind: "ready", items });
        }
      })
      .catch(() => {
        // 内部表現（"status=404" 等）は UI に出さない（ui-patterns.md §3.3）。
        if (reloadTokenRef.current === token) {
          setState({ kind: "error" });
        }
      });
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-xl font-semibold focus:outline-none"
      >
        テンプレート一覧
      </h1>
      {state.kind === "loading" && <TemplateListSkeleton />}
      {state.kind === "error" && (
        <Alert variant="destructive">
          <AlertTitle>テンプレートを取得できませんでした</AlertTitle>
          <AlertDescription>
            <p>時間をおいて再度お試しください。</p>
            <Button variant="outline" size="sm" onClick={load}>
              再読み込み
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {state.kind === "ready" && state.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          まだテンプレートがありません。管理者にお問い合わせください。
        </p>
      )}
      {state.kind === "ready" && state.items.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {state.items.map((template) => (
            <li key={template.id}>
              <TemplateCard
                template={template}
                onSelect={() => navigate(`/templates/${template.id}/new`)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: EnrichedTemplate;
  onSelect: () => void;
}) {
  return (
    <Card
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      className="cursor-pointer transition hover:ring-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">
          エージェント構成
        </h2>
        <ul className="space-y-1 text-sm">
          {template.agents.map((agent) => (
            <li
              key={agent.agent_id}
              className="flex justify-between gap-2 leading-tight"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {agent.agent_id}
              </span>
              <span>{describeAgent(agent)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function describeAgent(agent: AgentDefinition): string {
  if (agent.role === "investigation") {
    return `観点別調査役 — ${agent.specialization.perspective_name_ja}`;
  }
  return "統合役";
}

// Skeleton 件数は固定（2 枚）。実テンプレ件数に合わせて変動させると、
// fetch 中の見え方が読み込みごとに変わって「読み込み中である」というシグナルが
// 弱まる。MVP は 1 件確定（ADR-0005）だが本コンポーネントは件数中立に保つ。
function TemplateListSkeleton() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <li key={i}>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-3 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
