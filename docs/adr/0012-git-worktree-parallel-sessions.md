# 0012. Git Worktree による並行セッション運用の採用

## Status

accepted

- 作成日: 2026-04-21
- 関連: Issue #66, ADR-0011（関連）

## Context

同一ディレクトリで複数の Claude Code セッションを同時に動かせない。ブランチ切り替えやファイル編集が競合し、並行作業ができないため。

これを受け、Claude Code v2.1.49 以降で実装されたネイティブ Worktree サポート（`claude -w`）の採用を検討した。当環境は v2.1.89 で対応済み。

## Considered Alternatives

### 1. Claude Code ネイティブ worktree（採用・推奨）

`claude -w [name]` で worktree の作成からセッション起動まで一括で行う。

- ライフサイクル自動管理（変更なし→自動削除、変更あり→keep/remove 確認）
- `isolation: worktree` による subagent の分離実行
- `.worktreeinclude` で環境ファイルのコピーを制御
- `WorktreeCreate` / `WorktreeRemove` フックでカスタムロジック追加可能

### 2. 手動 `git worktree add`（採用・補助）

明示的なディレクトリ配置や長期間の作業ディレクトリ維持が必要な場合に使用。

- ディレクトリの配置場所を自由に決められる
- VS Code マルチルートワークスペースとの相性がよい
- ライフサイクルは手動管理

### 3. リポジトリの複数クローン（却下）

- ディスク容量を浪費する
- git データベースが分離し、ブランチ間の連携が煩雑

### 4. stash + ブランチ切り替え（却下）

- 単一ディレクトリの制約は解消しない
- 複数セッションの同時実行は不可能

## Decision

Git Worktree を採用する。Claude Code ネイティブ機能（`claude -w`）を推奨し、手動操作を補助的に併用する。

運用ルールは `docs/guides/worktree.md` に定義する。

## Consequences

- 複数の Claude Code セッションを干渉なく並行実行できる
- プロジェクトメモリは worktree ごとに独立する（パスベースで分離されるため）
- 各 worktree で `bun install` が必要
- `.claude/` 配下の設定・スキル・エージェントは git 追跡のため worktree でも動作する
- ネイティブ worktree はリポジトリルートに `.claude/worktrees/` を生成する（ADR-0009 リポジトリ構成への影響）
- `isolation: worktree` を指定したエージェント（ADR-0011）は独立した worktree で実行されるため、プロジェクトメモリと node_modules が分離する
