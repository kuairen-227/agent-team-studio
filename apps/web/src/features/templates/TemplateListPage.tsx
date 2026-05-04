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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
  | { kind: "error"; message: string };

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

  useEffect(() => {
    let cancelled = false;
    loadTemplates()
      .then((items) => {
        if (!cancelled) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">テンプレート一覧</h1>
      {state.kind === "loading" && <TemplateListSkeleton />}
      {state.kind === "error" && (
        <p className="text-sm text-destructive">
          読み込みに失敗しました: {state.message}
        </p>
      )}
      {state.kind === "ready" && state.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          テンプレートがありません
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
