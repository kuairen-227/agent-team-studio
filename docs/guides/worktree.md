# Git Worktree 運用ガイド

Claude Code の複数インスタンスで並行作業するための Git Worktree 運用手順。

## 概要

Git Worktree を使うと、1つのリポジトリから複数の作業ディレクトリを作成できる。ブランチの切り替えなしに複数の Issue を並行して作業できる。

## ディレクトリ構成

worktree はリポジトリの外側に配置する。

```text
/workspaces/
  agent-team-studio/              # メインの作業ツリー（main ブランチ）
  agent-team-studio--feat-auth/   # worktree: 認証機能の作業
  agent-team-studio--fix-login/   # worktree: ログイン修正
```

## 基本操作

### Worktree の作成

```bash
# 新しいブランチを作って worktree を作成
git worktree add ../agent-team-studio--feat-auth -b feat/auth

# 既存ブランチから worktree を作成
git worktree add ../agent-team-studio--feat-auth feat/auth
```

### Worktree での作業

worktree はメインリポジトリと同じ Git データベースを共有する。通常通りコミット・プッシュできる。

```bash
cd ../agent-team-studio--feat-auth
bun install
# 作業・コミット・プッシュ
```

### Worktree の一覧

```bash
git worktree list
```

### Worktree の削除

```bash
# 作業完了後（ブランチマージ後）
git worktree remove ../agent-team-studio--feat-auth
```

### 不要な worktree の一括整理

```bash
git worktree prune
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
