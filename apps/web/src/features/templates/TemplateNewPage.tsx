/**
 * 入力フォーム画面のプレースホルダ（[US-2](docs/product/user-stories.md#us-2-調査パラメータを入力して実行する) で実装）。
 *
 * US-1 では到達確認のみが目的のため、`templateId` を表示する空ページに留める。
 * 画面の実装は次 Issue で `features/templates/TemplateNewPage.tsx` を上書きする想定。
 */

import { useEffect, useRef } from "react";
import { useParams } from "react-router";

export function TemplateNewPage() {
  const { templateId } = useParams();
  // ui-patterns.md §7 / WCAG 2.1 SC 2.4.3: 画面遷移直後は <h1> に focus。
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-xl font-semibold focus:outline-none"
      >
        入力フォーム
      </h1>
      <p className="text-sm text-muted-foreground">
        US-2 で実装予定です（templateId: {templateId ?? "(none)"}）。
      </p>
    </section>
  );
}
