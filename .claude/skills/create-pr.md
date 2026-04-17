---
name: create-pr
description: プロジェクト規約に沿った PR を作成する。ブランチの変更内容を解析し、PR テンプレートに沿った本文を生成して gh pr create を実行する。
when_to_use: ユーザーが「PR作って」「プルリクエスト作成して」「PR出して」「マージしたい」などと言ったとき
argument-hint: "[issue-number]"
allowed-tools: Bash(git *) Bash(gh pr *) Read Grep
---

# create-pr

プロジェクトの規約に従って、現在のブランチから PR を作成する。

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

- コミットメッセージやブランチ名から Issue 番号を推測する
- 特定できない場合はユーザーに確認する（任意、なしでも可）

### 4. PR 本文の生成

`.github/PULL_REQUEST_TEMPLATE.md` の構造に従い、以下のセクションで本文を構成する:

```markdown
## What

<!-- 変更内容の簡潔な説明（コミット履歴・差分から要約） -->

## Why

<!-- 対応する Issue がある場合: closes #XX -->
<!-- Issue がない場合: 変更の動機を記載 -->

## How

<!-- 実装アプローチの説明。変更が小さい（ファイル数3以下かつ差分50行以内）場合は「軽微な変更のため省略」と記載 -->

## Checklist

- [ ] テストが通ること（該当する場合）
- [ ] ドキュメントを更新したこと（該当する場合）
```

### 5. PR タイトルの生成

- Conventional Commits のプレフィックス（`feat:`, `fix:`, `chore:`, `docs:` 等）で始める
- スコープがある場合は `type(scope):` 形式にする
- **70文字以内**に収める
- コミットが1つの場合はそのコミットメッセージをベースにする

### 6. リモートへの push

- 現在のブランチがリモートに push されているか確認する
- push されていない場合は `git push -u origin <branch>` で push する

### 7. PR 作成

```bash
gh pr create --title "<タイトル>" --body "<本文>"
```

- `--base main` はデフォルトなので省略可
- 作成後、PR の URL を表示する

## 規約リファレンス

- ブランチ命名: `docs/guides/branch-strategy.md`
- PR 運用ルール: `docs/guides/github-workflow.md`
- コミット規約: `CLAUDE.md` のコーディング規約セクション
