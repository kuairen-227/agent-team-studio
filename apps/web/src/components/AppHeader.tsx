/**
 * グローバルヘッダー（ui-patterns.md §4 のヘッダー固定方針）。
 *
 * Walking Skeleton では「テンプレート一覧」のみ実画面が存在する。
 * 「履歴一覧」は US-5 で実装するため、本コンポーネントでは存在しないリンクを置かない。
 * リンク 1 件のみで構成し、画面追加時にナビ項目を増やす。
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <a className="font-heading font-semibold" href="/">
          Agent Team Studio
        </a>
        <nav className="flex gap-4 text-sm">
          <a className="hover:underline" href="/">
            テンプレート一覧
          </a>
        </nav>
      </div>
    </header>
  );
}
