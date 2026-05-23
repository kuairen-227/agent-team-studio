/**
 * グローバルヘッダー（[ui-patterns.md §4](docs/design/ui-patterns.md) のヘッダー固定方針）。
 */

import { Link } from "@tanstack/react-router";

// 現在地ナビ項目に付与する activeProps（Nielsen #1 Visibility of system status）。
// `activeOptions.exact` で `/` がすべてのパスで active 化されるのを防ぐ。
const navActiveProps = {
  className: "underline font-medium",
  "aria-current": "page",
} as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <Link className="font-heading font-semibold" to="/">
          Agent Team Studio
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link
            className="hover:underline"
            to="/"
            activeOptions={{ exact: true }}
            activeProps={navActiveProps}
          >
            テンプレート一覧
          </Link>
          <Link
            className="hover:underline"
            to="/history"
            activeProps={navActiveProps}
          >
            履歴一覧
          </Link>
        </nav>
      </div>
    </header>
  );
}
