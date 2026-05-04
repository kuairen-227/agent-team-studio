/**
 * グローバルヘッダー（[ui-patterns.md §4](docs/design/ui-patterns.md) のヘッダー固定方針）。
 *
 * 「履歴一覧」は US-5 で実装するため、現時点ではリンクを置かない。
 * 画面追加時にナビ項目を増やす。
 */

import { Link } from "react-router";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <Link className="font-heading font-semibold" to="/">
          Agent Team Studio
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link className="hover:underline" to="/">
            テンプレート一覧
          </Link>
        </nav>
      </div>
    </header>
  );
}
