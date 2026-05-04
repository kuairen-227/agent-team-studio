/**
 * アプリ全体のルート定義（[ui-patterns.md §8](docs/design/ui-patterns.md), [ADR-0025](docs/adr/0025-spa-routing-library.md)）。
 *
 * ルート定義は本ファイルに集約し、Router 乗り換え時の改修箇所を可視化する
 * （ADR-0025 Decision）。`<AppHeader>` は全ルート共通のレイアウトとして配置する。
 *
 * `loader` / `action` 等の Router 固有 API は使わず、データ取得は各画面コンポーネント内の
 * `useEffect` に閉じる方針（ADR-0025）。
 */

import { Navigate, Route, Routes } from "react-router";
import { AppHeader } from "@/components/AppHeader";
import { TemplateListPage } from "@/features/templates/TemplateListPage";
import { TemplateNewPage } from "@/features/templates/TemplateNewPage";

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<TemplateListPage />} />
          <Route
            path="/templates/:templateId/new"
            element={<TemplateNewPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
