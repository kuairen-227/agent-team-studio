---
name: create-pr
description: プロジェクト規約に沿った PR を作成する。ブランチの変更内容を解析し、PR テンプレートに沿った本文を生成して gh pr create を実行する。
when_to_use: ユーザーが「PR作って」「プルリクエスト作成して」「PR出して」「マージしたい」などと言ったとき
argument-hint: "[issue-number]"
allowed-tools: Bash(git status:*) Bash(git log:*) Bash(git diff:*) Bash(git push:*) Bash(gh pr create:*) Bash(gh pr view:*) Read Grep
---

# create-pr

プロジェクトの規約に従って、現在のブランチから PR を作成する。

PR テンプレート:

!`cat .github/PULL_REQUEST_TEMPLATE.md`

## 手順

### 1. 事前チェック

- 現在のブランチが `main` でないことを確認する。`main` の場合はエラーを表示して終了
- `git status` で未コミットの変更がないか確認する。ある場合はユーザーに通知して判断を仰ぐ

### 2. 変更内容の把握

以下のコマンドで変更内容を収集する:

- `git log main..HEAD --oneline` — コミット一覧
- `git diff main...HEAD --stat` — 変更ファイルの統計
- `git diff main...HEAD` — 差分の詳細

### 3. 対応 Issue の特定

- `$ARGUMENTS` で Issue 番号が指定されていればそれを使用する
- 指定がなければコミットメッセージやブランチ名から推測する
- 特定できない場合はユーザーに確認する（任意、なしでも可）

### 4. PR 本文の生成

上記の PR テンプレートの構造に従って本文を構成する:

- **What**: コミット履歴・差分から変更内容を要約
- **Why**: 対応 Issue がある場合は `closes #XX`、ない場合は動機を記載
- **How**: 実装アプローチ。変更が小さい（ファイル数3以下かつ差分50行以内）場合は「軽微な変更のため省略」
- **Checklist**: テンプレートのチェックリストをそのまま含める

### 5. PR タイトルの生成

- CLAUDE.md のコミット規約に従い、Conventional Commits プレフィックスで始める
- **70文字以内**に収める
- コミットが1つの場合はそのコミットメッセージをベースにする

### 6. リモートへの push

- 現在のブランチがリモートに push されているか確認する
- push されていない場合は `git push -u origin <branch>` で push する

### 7. PR 作成

```bash
gh pr create --title "<タイトル>" --body "<本文>"
```

- 作成後、PR の URL を表示する
