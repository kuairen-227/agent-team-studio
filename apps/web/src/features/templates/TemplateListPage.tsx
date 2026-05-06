/**
 * テンプレート一覧画面（US-1）。
 *
 * 各カードにエージェント構成を出すために詳細 fetch を 1 件ずつ追加で叩く N+1 を
 * 許容している。MVP は 1 テンプレ前提（ADR-0005）。件数が増えた段階で
 * `TemplateSummary` 拡張または集約エンドポイントで再考する。
 */

import type {
  AgentDefinition,
  GetTemplateResponse,
  GetTemplatesResponse,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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
import { fetchJson } from "@/lib/api";

type EnrichedTemplate = TemplateSummary & { agents: AgentDefinition[] };

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
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    data: items,
    status,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["templates"],
    queryFn: loadTemplates,
  });

  // ui-patterns.md §7 / WCAG 2.1 SC 2.4.3: 画面遷移直後は <h1> に focus。
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-xl font-semibold focus:outline-none"
      >
        テンプレート一覧
      </h1>
      {status === "pending" && <TemplateListSkeleton />}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>テンプレートを取得できませんでした</AlertTitle>
          <AlertDescription>
            <p>時間をおいて再度お試しください。</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "読み込み中…" : "再読み込み"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {status === "success" && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          まだテンプレートがありません。管理者にお問い合わせください。
        </p>
      )}
      {status === "success" && items.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((template) => (
            <li key={template.id}>
              <TemplateCard
                template={template}
                onSelect={() =>
                  navigate({
                    to: "/templates/$templateId/new",
                    params: { templateId: template.id },
                  })
                }
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
