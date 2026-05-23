/**
 * 履歴一覧画面（US-5）。
 *
 * `/api/executions` と `/api/templates` を並列取得し、テンプレ名を Execution に紐付ける。
 * 履歴は同じ templateId を共有するため一覧 API を 1 回呼んで Map で join する
 * （TemplateListPage の N+1 パターンは採らない）。
 *
 * empty 時はテンプレート一覧への導線を出す（[ui-patterns.md §3.2](../../../docs/design/ui-patterns.md)）。
 */

import type {
  ExecutionStatus,
  ExecutionSummary,
  GetExecutionsResponse,
  GetTemplatesResponse,
  TemplateSummary,
} from "@agent-team-studio/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/api";

type HistoryItem = ExecutionSummary & { templateName: string };

async function loadHistory(): Promise<HistoryItem[]> {
  const [executions, templates] = await Promise.all([
    fetchJson<GetExecutionsResponse>("/api/executions"),
    fetchJson<GetTemplatesResponse>("/api/templates"),
  ]);
  const nameById = new Map<string, string>(
    templates.items.map((t: TemplateSummary) => [t.id, t.name]),
  );
  return executions.items.map((e) => ({
    ...e,
    templateName: nameById.get(e.templateId) ?? e.templateId,
  }));
}

// API は `createdAt DESC` で返るため、UI 側で再ソートはしない（SSoT 原則）。

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function HistoryListPage() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    data: items,
    status,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["history"],
    queryFn: loadHistory,
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
        履歴一覧
      </h1>
      {status === "pending" && <HistoryListSkeleton />}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>履歴を取得できませんでした</AlertTitle>
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
        <div className="text-center text-sm text-muted-foreground">
          <p className="mb-2">まだ実行がありません。</p>
          <Link className="underline" to="/">
            テンプレート一覧から実行する
          </Link>
        </div>
      )}
      {status === "success" && items.length > 0 && (
        <ul className="space-y-3" aria-label="実行履歴">
          {items.map((item) => (
            <li key={item.id}>
              <HistoryCard
                item={item}
                onSelect={() =>
                  navigate({
                    to: "/executions/$executionId",
                    params: { executionId: item.id },
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

function HistoryCard({
  item,
  onSelect,
}: {
  item: HistoryItem;
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
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{item.templateName}</CardTitle>
        <Badge variant={item.status as ExecutionStatus} />
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          <time dateTime={item.createdAt}>
            {formatDateTime(item.createdAt)}
          </time>
        </p>
      </CardContent>
    </Card>
  );
}

function HistoryListSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
