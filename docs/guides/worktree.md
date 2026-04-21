# Git Worktree 運用ガイド

Claude Code の複数セッションで並行作業するための Git Worktree 運用手順。

意思決定の背景は [ADR-0012](../adr/0012-git-worktree-parallel-sessions.md) を参照。

## 概要

Git Worktree を使うと、1つのリポジトリから複数の作業ディレクトリを作成できる。ブランチの切り替えなしに複数の Issue を並行して作業できる。

## Claude Code ネイティブ Worktree（推奨）

Claude Code v2.1.49+ のネイティブ Worktree サポートを使う。ライフサイクルが自動管理される。

### 起動

```bash
# 名前を指定して起動
claude -w feat-auth

# 名前を省略（自動生成）
claude -w

# tmux セッションと統合
claude -w feat-auth --tmux
```

`.claude/worktrees/<name>/` に worktree が作成され、そのディレクトリで Claude Code セッションが開始される。

### ライフサイクル

1. **起動時**: worktree を自動作成し、デフォルトリモートブランチから分岐
2. **実行中**: 独立したブランチで作業
3. **完了時**:
   - 変更なし → 自動削除
   - 変更あり → keep/remove を確認（keep 選択時は後から再開可能）

### 環境ファイルの引き継ぎ

`.gitignore` 対象のファイル（`.env` 等）を worktree にコピーするには、リポジトリルートに `.worktreeinclude` を作成する:

```text
.env
.env.*
```

`.worktreeinclude` と `.gitignore` の両方に一致するファイルのみがコピーされる。

### WorktreeCreate フック

worktree 作成時にカスタム処理を実行するには、`.claude/settings.json` にフックを定義する:

```json
{
  "hooks": {
    "WorktreeCreate": [{
      "hooks": [{
        "type": "command",
        "command": "cd $WORKTREE_PATH && bun install"
      }]
    }]
  }
}
```

## Subagent の Worktree 分離

スキルやエージェントのフロントマターに `isolation: worktree` を指定すると、subagent が独立した worktree で実行される:

```yaml
---
name: parallel-implementer
isolation: worktree
---
```

セッション中に「use worktrees for your agents」と指示しても有効化できる。

## 手動操作

ネイティブ機能ではなく `git worktree` を直接使う場合の手順。ディレクトリ配置を明示的に制御したい場合や、長期間の作業ディレクトリを維持したい場合に使う。

### ディレクトリ構成

worktree はリポジトリの外側に配置する。

```text
/workspaces/
  agent-team-studio/              # メインの作業ツリー（main ブランチ）
  agent-team-studio--feat-auth/   # worktree: 認証機能の作業
  agent-team-studio--fix-login/   # worktree: ログイン修正
```

### 基本コマンド

```bash
# 新しいブランチを作って worktree を作成
git worktree add ../agent-team-studio--feat-auth -b feat/auth

# 既存ブランチから worktree を作成
git worktree add ../agent-team-studio--feat-auth feat/auth

# 一覧表示
git worktree list

# 削除（マージ後）
git worktree remove ../agent-team-studio--feat-auth

# 不要な worktree の一括整理
git worktree prune
```

### 手動 worktree での作業開始

```bash
cd ../agent-team-studio--feat-auth
bun install
claude  # Claude Code セッションを起動
```

## Claude Code の動作互換性

worktree 環境での各コンポーネントの動作状況:

| コンポーネント | 動作 | 備考 |
| --- | --- | --- |
| スキル (`.claude/skills/`) | OK | git 追跡。相対パスも worktree ルートから解決される |
| エージェント (`.claude/agents/`) | OK | git 追跡 |
| 設定 (`.claude/settings.json`) | OK | git 追跡 |
| Husky pre-commit hooks | OK | `.husky/` も git 追跡 |
| `gh` CLI / git 操作 | OK | worktree も通常の git リポジトリとして動作 |
| プロジェクトメモリ | **独立** | パスベースで分離される。worktree ごとに別のメモリ空間 |
| `node_modules/` | **独立** | `.gitignore` 対象。worktree ごとに `bun install` が必要 |
| `_dev/` | **独立** | `.gitignore` 対象。worktree 間で共有されない |

### 注意: statusLine の絶対パス

`.claude/settings.json` の `statusLine.command` がメインツリーへの絶対パスを参照している。スクリプト自体はパス非依存のため動作するが、メインツリーが移動・削除されると壊れる。

## 並行作業の典型パターン

### ネイティブ worktree

```bash
# Terminal 1: メインツリーでタスク管理・レビュー
claude

# Terminal 2: feat/auth の実装
claude -w feat-auth

# Terminal 3: fix/login の修正
claude -w fix-login
```

### 手動 worktree

```bash
# Terminal 1: メインツリー（main）でタスク管理・レビュー
cd /workspaces/agent-team-studio && claude

# Terminal 2: worktree で feat/auth の実装
cd /workspaces/agent-team-studio--feat-auth && claude

# Terminal 3: worktree で fix/login の修正
cd /workspaces/agent-team-studio--fix-login && claude
```

## VS Code での利用

worktree を VS Code で開けば、Git 統合（差分表示・ステージング・コミット）は通常通り使える。worktree 内に `.git` ファイル（メインリポジトリへのポインタ）が作られるため。

```bash
code ../agent-team-studio--feat-auth
```

メインツリーと worktree を1つのウィンドウで同時に見たい場合は、マルチルートワークスペースとして両方を追加できる。

## 注意事項

- 同じブランチを複数の worktree で同時にチェックアウトできない
- 各 worktree で `bun install` を実行して依存をインストールすること
- worktree 内の `node_modules/` や `.turbo/` はメインツリーとは独立
- worktree 間でファイルを直接コピーしない（git 経由でやり取りする）
- `_dev/` は `.gitignore` 対象のため worktree 間で共有されない
- ネイティブ worktree を使う場合、`.gitignore` に `.claude/worktrees/` を追加する
