/**
 * 入力フォーム画面（[US-2](docs/product/user-stories.md#us-2-調査パラメータを入力して実行する)）。
 *
 * 入力スキーマは MVP の競合調査テンプレート固定（[ADR-0005](docs/adr/0005-mvp-scope.md),
 * [competitor-analysis.md](docs/design/templates/competitor-analysis.md)）。複数テンプレ対応は v2。
 *
 * バリデーションエラーは API の `details[].field` をそのままフォーム要素直下に
 * inline 表示する（[ui-patterns.md §3.3 error](docs/design/ui-patterns.md)）。
 *
 * Router 固有 API（loader / action）には寄せず、`fetch` は `useEffect` / submit ハンドラ内に
 * 閉じる（[ADR-0025](docs/adr/0025-spa-routing-library.md) Decision）。
 */

import type {
  ApiError,
  ApiValidationError,
  CompetitorAnalysisParameters,
  CreateExecutionRequest,
  CreateExecutionResponse,
  GetTemplateResponse,
} from "@agent-team-studio/shared";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const MAX_COMPETITORS = 5;
const MIN_COMPETITORS = 1;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; template: GetTemplateResponse }
  | { kind: "load-error" };

type FieldErrors = {
  competitors?: string;
  competitorItems: Record<number, string>;
  reference?: string;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submit-error"; message: string }
  | { kind: "validation-error"; errors: FieldErrors };

const emptyFieldErrors: FieldErrors = { competitorItems: {} };

export function TemplateNewPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [reference, setReference] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  const headingRef = useRef<HTMLHeadingElement>(null);
  const competitorsLabelId = useId();
  const competitorsHelpId = useId();
  const competitorsErrorId = useId();
  const competitorItemErrorIdPrefix = useId();
  const referenceFieldId = useId();
  const referenceErrorId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!templateId) {
      setLoadState({ kind: "load-error" });
      return;
    }
    let aborted = false;
    setLoadState({ kind: "loading" });
    fetch(`/api/templates/${templateId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status=${res.status}`);
        return (await res.json()) as GetTemplateResponse;
      })
      .then((template) => {
        if (!aborted) setLoadState({ kind: "ready", template });
      })
      .catch(() => {
        if (!aborted) setLoadState({ kind: "load-error" });
      });
    return () => {
      aborted = true;
    };
  }, [templateId]);

  const filledCount = competitors.filter((c) => c.trim().length > 0).length;
  const submitDisabled =
    submitState.kind === "submitting" ||
    filledCount < MIN_COMPETITORS ||
    loadState.kind !== "ready";

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!templateId) return;
      // 空行はサーバ送信前に除外する。残りで MIN を満たさなければ disabled で押下不可のため到達しない。
      const cleanedCompetitors = competitors
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      const trimmedReference = reference.trim();
      const parameters: CompetitorAnalysisParameters = {
        competitors: cleanedCompetitors,
        ...(trimmedReference.length > 0 ? { reference: trimmedReference } : {}),
      };
      const body: CreateExecutionRequest = {
        templateId,
        parameters,
      };

      setSubmitState({ kind: "submitting" });
      try {
        const res = await fetch("/api/executions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 202) {
          const created = (await res.json()) as CreateExecutionResponse;
          navigate(`/executions/${created.id}`);
          return;
        }
        const err = (await res.json().catch(() => null)) as ApiError | null;
        if (err?.errorCode === "validation_error") {
          setSubmitState({
            kind: "validation-error",
            errors: mapValidationErrors(err),
          });
          return;
        }
        setSubmitState({
          kind: "submit-error",
          message:
            err?.message ?? "実行を開始できませんでした。再度お試しください",
        });
      } catch {
        setSubmitState({
          kind: "submit-error",
          message: "実行を開始できませんでした。再度お試しください",
        });
      }
    },
    [competitors, navigate, reference, templateId],
  );

  const fieldErrors =
    submitState.kind === "validation-error"
      ? submitState.errors
      : emptyFieldErrors;

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-xl font-semibold focus:outline-none"
      >
        入力フォーム
      </h1>

      {loadState.kind === "loading" && <FormSkeleton />}

      {loadState.kind === "load-error" && (
        <Alert variant="destructive">
          <AlertTitle>テンプレートを取得できませんでした</AlertTitle>
          <AlertDescription>
            <p>時間をおいて再度お試しください。</p>
          </AlertDescription>
        </Alert>
      )}

      {loadState.kind === "ready" && (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            {loadState.template.name} ・ {loadState.template.description}
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <fieldset className="space-y-2">
              <legend
                id={competitorsLabelId}
                className="text-sm font-medium leading-none"
              >
                競合企業名 <span aria-hidden="true">*</span>
              </legend>
              <p
                id={competitorsHelpId}
                className="text-xs text-muted-foreground"
              >
                {MIN_COMPETITORS}〜{MAX_COMPETITORS} 件、各 1〜100 文字
              </p>
              <ul className="space-y-2">
                {competitors.map((value, index) => {
                  const itemError = fieldErrors.competitorItems[index];
                  const itemErrorId = `${competitorItemErrorIdPrefix}-${index}`;
                  // 各 input には説明 (help) と「グループ全体エラー / 自身のエラー」を結合する。
                  // 空 id を含めないように filter で空白を除去する。
                  const describedBy =
                    [
                      competitorsHelpId,
                      fieldErrors.competitors ? competitorsErrorId : "",
                      itemError ? itemErrorId : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined;
                  return (
                    // 並び替えなし・index と表示順を 1:1 で同期する素朴な実装。
                    // biome-ignore lint/suspicious/noArrayIndexKey: index と表示位置が同期し並び替えしないため安定
                    <li key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          aria-labelledby={competitorsLabelId}
                          aria-describedby={describedBy}
                          aria-invalid={itemError ? true : undefined}
                          value={value}
                          onChange={(e) => {
                            const next = [...competitors];
                            next[index] = e.target.value;
                            setCompetitors(next);
                          }}
                          placeholder={`競合企業 ${index + 1}`}
                          maxLength={100}
                        />
                        {itemError && (
                          <p
                            id={itemErrorId}
                            className="mt-1 text-xs text-destructive"
                          >
                            {itemError}
                          </p>
                        )}
                      </div>
                      {competitors.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCompetitors(
                              competitors.filter((_, i) => i !== index),
                            );
                          }}
                          aria-label={`競合企業 ${index + 1} を削除`}
                        >
                          削除
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {competitors.length < MAX_COMPETITORS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCompetitors([...competitors, ""])}
                >
                  競合企業を追加
                </Button>
              )}
              {fieldErrors.competitors && (
                <p id={competitorsErrorId} className="text-xs text-destructive">
                  {fieldErrors.competitors}
                </p>
              )}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor={referenceFieldId}>参考情報（任意）</Label>
              <p className="text-xs text-muted-foreground">
                ユーザーが手で貼り付けたテキストのみを LLM に渡す。Web
                取得は行わない（〜10000 文字）
              </p>
              <Textarea
                id={referenceFieldId}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                rows={6}
                maxLength={10000}
                aria-invalid={fieldErrors.reference ? true : undefined}
                aria-describedby={
                  fieldErrors.reference ? referenceErrorId : undefined
                }
              />
              {fieldErrors.reference && (
                <p id={referenceErrorId} className="text-xs text-destructive">
                  {fieldErrors.reference}
                </p>
              )}
            </div>

            {submitState.kind === "submit-error" && (
              <Alert variant="destructive">
                <AlertTitle>実行を開始できませんでした</AlertTitle>
                <AlertDescription>{submitState.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitDisabled}>
                {submitState.kind === "submitting" ? "実行中…" : "実行する"}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function mapValidationErrors(err: ApiValidationError): FieldErrors {
  const result: FieldErrors = { competitorItems: {} };
  for (const detail of err.details) {
    if (detail.field === "competitors") {
      result.competitors = detail.reason;
      continue;
    }
    const competitorMatch = /^competitors\.(\d+)$/.exec(detail.field);
    if (competitorMatch) {
      const index = Number.parseInt(competitorMatch[1] ?? "", 10);
      if (Number.isFinite(index)) {
        result.competitorItems[index] = detail.reason;
      }
      continue;
    }
    if (detail.field === "reference") {
      result.reference = detail.reason;
    }
  }
  return result;
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-32" />
    </div>
  );
}
