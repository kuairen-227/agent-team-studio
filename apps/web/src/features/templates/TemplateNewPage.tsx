/**
 * 競合調査テンプレート専用の入力フォーム。MVP では `parameters` 構造をテンプレ横断で
 * 抽象化せず、`CompetitorAnalysisParameters` に固定する（v2 で動的化予定）。
 */

import type {
  ApiError,
  ApiValidationError,
  CompetitorAnalysisParameters,
  CreateExecutionRequest,
  CreateExecutionResponse,
  GetTemplateResponse,
} from "@agent-team-studio/shared";
import { Loader2 } from "lucide-react";
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
  // 再試行ボタンで useEffect を再実行するためのカウンタ。fetch の中断・state 衝突を
  // useEffect の cleanup で一元管理する（独立した abort パスを持たせない）。
  const [reloadCounter, setReloadCounter] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const competitorRefs = useRef<(HTMLInputElement | null)[]>([]);
  const referenceRef = useRef<HTMLTextAreaElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const competitorsLabelId = useId();
  const competitorsHelpId = useId();
  const competitorsErrorId = useId();
  const competitorItemErrorIdPrefix = useId();
  const referenceFieldId = useId();
  const referenceHelpId = useId();
  const referenceErrorId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // reloadCounter は再試行ボタンの再実行トリガ。effect 内で参照しないが意図的に依存として残す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadCounter is intentional retry trigger
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
  }, [templateId, reloadCounter]);

  useEffect(() => {
    if (submitState.kind !== "validation-error") return;
    const errors = submitState.errors;
    if (errors.competitors) {
      competitorRefs.current[0]?.focus();
      return;
    }
    const itemIndices = Object.keys(errors.competitorItems).map(Number);
    if (itemIndices.length > 0) {
      const first = Math.min(...itemIndices);
      competitorRefs.current[first]?.focus();
      return;
    }
    if (errors.reference) {
      referenceRef.current?.focus();
    }
  }, [submitState]);

  // submit-error 遷移時は submit ボタンへフォーカスを戻す。submitting 中は disabled で
  // フォーカスが body へ落ちており、Alert は role="alert" のみで focus は奪わない方針
  // （ui-patterns.md §7）のため、明示的にボタンへ復帰させる。
  useEffect(() => {
    if (submitState.kind === "submit-error") {
      submitButtonRef.current?.focus();
    }
  }, [submitState]);

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
      // 同時に「送信後 index → UI 配列 index」の対応マップも作る。サーバの validation_error
      // が `competitors.N` を返したとき、UI 表示位置（空行を含む）に正しく復元するため。
      const cleanedCompetitors: string[] = [];
      const cleanedToUiIndex: number[] = [];
      competitors.forEach((c, uiIndex) => {
        const trimmed = c.trim();
        if (trimmed.length > 0) {
          cleanedCompetitors.push(trimmed);
          cleanedToUiIndex.push(uiIndex);
        }
      });
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
          const mapped = mapValidationErrors(err, cleanedToUiIndex);
          // 既知フィールドが何もマップできなかった（サーバ側の制約変更等で
          // UI が認識しないフィールド名が返ってきた）場合は無音失敗を防ぐため
          // submit-error にフォールバックする。
          if (!mapped) {
            setSubmitState({
              kind: "submit-error",
              message: err.message ?? "入力に誤りがあります",
            });
            return;
          }
          setSubmitState({ kind: "validation-error", errors: mapped });
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
      <h1 ref={headingRef} tabIndex={-1} className="mb-2 text-xl font-semibold">
        入力フォーム
      </h1>

      {loadState.kind === "loading" && <FormSkeleton />}

      {loadState.kind === "load-error" && (
        <Alert variant="destructive">
          <AlertTitle>テンプレートを取得できませんでした</AlertTitle>
          <AlertDescription>
            <p>時間をおいて再度お試しください。</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setReloadCounter((c) => c + 1)}
            >
              再試行
            </Button>
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
                          ref={(el) => {
                            competitorRefs.current[index] = el;
                          }}
                          aria-labelledby={competitorsLabelId}
                          aria-describedby={describedBy}
                          aria-invalid={itemError ? true : undefined}
                          aria-required="true"
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
              <p id={referenceHelpId} className="text-xs text-muted-foreground">
                ユーザーが手で貼り付けたテキストのみを LLM に渡す。Web
                取得は行わない（〜10000 文字）
              </p>
              <Textarea
                ref={referenceRef}
                id={referenceFieldId}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                rows={6}
                maxLength={10000}
                aria-invalid={fieldErrors.reference ? true : undefined}
                aria-describedby={
                  fieldErrors.reference
                    ? `${referenceHelpId} ${referenceErrorId}`
                    : referenceHelpId
                }
              />
              {fieldErrors.reference && (
                <p id={referenceErrorId} className="text-xs text-destructive">
                  {fieldErrors.reference}
                </p>
              )}
            </div>

            {/* submitting → submit-error の遷移で Alert は一度アンマウント → 再挿入される。
                同一メッセージで再送信した場合も role="alert" が再アナウンスされるのはこの挙動に依存する。 */}
            {submitState.kind === "submit-error" && (
              <Alert variant="destructive">
                <AlertTitle>実行を開始できませんでした</AlertTitle>
                <AlertDescription>{submitState.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                ref={submitButtonRef}
                type="submit"
                disabled={submitDisabled}
              >
                {submitState.kind === "submitting" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    実行中…
                  </>
                ) : (
                  "実行する"
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function mapValidationErrors(
  err: ApiValidationError,
  cleanedToUiIndex: number[],
): FieldErrors | null {
  const result: FieldErrors = { competitorItems: {} };
  let mappedCount = 0;
  for (const detail of err.details) {
    if (detail.field === "competitors") {
      result.competitors = detail.reason;
      mappedCount++;
      continue;
    }
    const competitorMatch = /^competitors\.(\d+)$/.exec(detail.field);
    if (competitorMatch) {
      const cleanedIndex = Number.parseInt(competitorMatch[1] ?? "", 10);
      const uiIndex = cleanedToUiIndex[cleanedIndex];
      if (uiIndex !== undefined) {
        result.competitorItems[uiIndex] = detail.reason;
        mappedCount++;
      }
      continue;
    }
    if (detail.field === "reference") {
      result.reference = detail.reason;
      mappedCount++;
    }
  }
  return mappedCount > 0 ? result : null;
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
