# Skills

`.claude/skills/*/SKILL.md` の作成規約。スキルを追加・編集するときは本ドキュメントの共通スキーマに従う。

スキルの設計判断（スキル化するか rules/agents に置くか）は [docs/guides/ai-driven-development.md](../../docs/guides/ai-driven-development.md) を SSoT とする。本ドキュメントは frontmatter の記述規約に限定する。

## frontmatter 共通スキーマ

YAML frontmatter は `---` で囲み、以下のフィールドを**グループ順**で記述する。全フィールドは [Claude Code 公式仕様](https://code.claude.com/docs/en/skills.md)（2026-06 時点で確認）のサポート範囲内。URL が陳腐化した場合は `code.claude.com/docs` の Skills ページ、または `/help` 経由のドキュメントを参照する。

| グループ | フィールド | 区分 | 規約 |
| --- | --- | --- | --- |
| Identity | `name` | 必須 | スキルの表示名。ディレクトリ名と一致させる |
| | `description` | 必須 | 何をするスキルか。Claude が起動要否を判断する主材料 |
| | `when_to_use` | 必須 | 起動トリガー（ユーザーの言い回し例）。`description` に追記され合算 1,536 文字（2026-06 確認）で切られるため要点を先頭に |
| Invocation | `argument-hint` | 引数ありのみ | `"<issue-number>"` / `"[new\|update] [対象]"` 形式。引数を取らないスキルでは省略 |
| | `disable-model-invocation` | 任意 | `true` で手動起動（`/skill`）のみに限定し、Claude の自動起動を抑止。description も常時コンテキストから外れる。付与基準は2軸 — ①破壊的操作・副作用がありタイミングを人が握るべきスキル、②引数必須の単発判断スキルで自動起動が意味をなさないもの（例: `judge-dev-mode`） |
| | `user-invocable` | 任意 | `false` で `/` メニューから隠す（Claude 専用知識スキル）。デフォルト `true` |
| Execution | `model` | 任意 | デフォルト以外のモデルを使う場合のみ（例: `haiku`） |
| | `effort` | 任意 | `low`/`medium`/`high`/`xhigh`/`max`。セッション設定を上書きする場合のみ |
| | `context` + `agent` | fork のみ・対で | `context: fork` で forked subagent 実行。`agent` で subagent タイプを指定 |
| Permissions | `allowed-tools` | 必須・末尾 | スキル稼働中に許可なく使えるツール。後述の記法に従う |
| | `disallowed-tools` | 任意 | 稼働中にプールから除外するツール |

### フィールド順序

上表の**グループ順（Identity → Invocation → Execution → Permissions）**で記述する。グループ内も上表の順に並べる。`allowed-tools` は常に末尾。

### allowed-tools の記法

- **スペース区切り**で列挙する（カンマ・YAML リストも公式には可だが本リポジトリはスペース区切りに統一）。
- Bash は `Bash(<command>:*)` 形式でサブコマンド単位に絞る。例: `Bash(git switch:*)` `Bash(gh issue view:*)`。
- **最小権限**を優先する。破壊的サブコマンドを含むコマンドは、本文が実際に使う操作だけに絞る。例: `git worktree` は `list` のみ使うなら `Bash(git worktree list:*)`（`add`/`remove`/`prune` を含む `Bash(git worktree:*)` にしない）。固定パスにしか作用しないなら `Bash(cat docs/product/glossary.md:*)` のようにパスまで絞る。
- 例外として、サブコマンドが全て `package.json` 等のプロジェクト内部スクリプトで権限差がない場合は、列挙の冗長さを避けて広めに許可してよい。例: 品質ゲートで複数の `bun run <script>` を使うスキルは `Bash(bun run:*)` でまとめる。
- 素のツールはツール名のみ。例: `Read` `Grep` `Glob` `Edit` `Write` `Agent`。
- MCP ツールは `mcp__<server>__*`。例: `mcp__playwright__*`。
- 他スキルへ委譲する場合は委譲先を明示。例: `Skill(implement-feature)`。委譲先が定まらない場合のみ素の `Skill`。
- **必要十分**にする。本文（`SKILL.md`）が実際に実行するコマンド・ツールを過不足なく列挙する。動的注入（`` !`cat docs/product/glossary.md` ``）も対象ツール（注入先パスまで絞った `Bash(cat docs/product/glossary.md:*)`）を含める。

> [!NOTE]
> エージェント（`.claude/agents/*`）は frontmatter フィールドが `tools:`（カンマ区切り）で、スキルの `allowed-tools:` とは別物。混同しない。

## スキル一覧

| スキル | 引数 | 起動 | 主な権限の軸 |
| --- | --- | --- | --- |
| cleanup-merged-branch | なし | auto（`model: haiku`） | git 操作（`git worktree list` 含む） |
| create-adr | `[title-or-topic]` | auto | gh issue 参照 + ファイル編集 |
| create-issue | `[type] [title]` | auto | gh issue/label 作成 |
| create-pr | `[issue-number]` | auto | git push + gh pr 作成 |
| implement-feature | `[issue-or-context]` | auto | bun/git + Playwright + Skill(create-adr) |
| judge-dev-mode | `<issue-number>` | **手動のみ** | gh issue 参照（判断のみ・副作用なし） |
| manage-issue | `[status\|plan\|scope]` | auto（`context: fork`, `agent: pm`） | gh issue/milestone 全般 |
| process-issue | `<issue-number>` | auto | gh/git + bun + Skill(implement-feature) |
| resolve-review | `<pr-number>` | auto | gh pr + git commit + bun |
| review | `[type] [対象]` | auto | gh pr/issue 参照 + Agent |
| write-design-doc | `[new\|update] [対象]` | auto | docs 編集 |
| write-product-doc | `[new\|update] [対象]` | auto | docs 編集 + glossary 動的注入 |
