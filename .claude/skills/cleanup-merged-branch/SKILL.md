---
name: cleanup-merged-branch
description: PR マージ後の post-merge クリーンアップ。現在のブランチを記録 → main へ戻り → 最新を pull → マージ済みのローカルブランチを安全削除する軽量スキル。
when_to_use: ユーザーが「マージしました」「マージ完了」「マージしたよ」「PR マージしたよ」「マージ後の整理」「マージ済みブランチ削除」などと言ったとき
model: haiku
allowed-tools: Bash(git branch:*) Bash(git switch:*) Bash(git pull:*) Bash(git fetch:*) Bash(git status:*) Bash(git log:*)
---

# cleanup-merged-branch

PR マージ後に、main へ戻って最新を pull し、マージ済みのローカルブランチを削除する軽量タスク。

## モデル

`model: haiku` を frontmatter で指定している。本スキルの操作は決定論的な git コマンド数本で構成され、判断要素が少ないため Haiku で十分。Opus/Sonnet で起動するのはコストの無駄。

## 手順

### 1. 現在のブランチを記録

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

- `CURRENT_BRANCH` が空（detached HEAD）または `main` の場合は「クリーンアップ対象なし」と報告して終了。

### 2. 未コミット変更の確認

```bash
git status --porcelain
```

- 出力がある場合は警告し、ユーザーに **コミット / stash / 破棄** の判断を仰いで終了。自動で stash したり破棄したりしない。

### 3. main へ切り替えて最新を pull

```bash
git switch main && git pull origin main
```

- pull で fast-forward できない場合（main が予期せず分岐している等）はエラーを報告して終了。

### 4. 記録したブランチを削除

```bash
git branch -d "$CURRENT_BRANCH"
```

- **`-d`（小文字）を使う**。マージされていないブランチは削除されない安全モード。
- 失敗した場合（未マージ・別 worktree で checkout 中 等）はエラーをそのままユーザーに報告し、`-D`（強制削除）への切り替えは**ユーザー判断に委ねる**。
- 既に削除済みの場合（remote 経由で自動削除等）もエラーになるが、想定内として報告して続行。

### 5. 状態確認

```bash
git log --oneline -3
```

直近 3 コミットを表示して完了。マージされた PR のスカッシュコミットが先頭に来ていることを軽く触れる。

## 注意点

- **`-D` を使わない**：未マージブランチの強制削除はデータ消失リスクがある。手動でやってもらう
- **複数ブランチの一括削除はしない**：本スキルは「直前まで作業していた 1 ブランチ」の片付けに専念する。他のローカルブランチ整理は対象外
- **worktree 配下のブランチには触れない**：`git worktree list` で見えるブランチは、worktree 側で完了処理が必要なため対象外
- **リモートブランチは触らない**：GitHub の PR マージ設定で自動削除されるのが通常。スキルは local 側のみを担当
