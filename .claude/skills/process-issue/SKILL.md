---
name: process-issue
description: GitHub Issue の内容を読み取り、作業計画を立てて実装を行う。Issue 番号を引数に指定する。
when_to_use: ユーザーが「Issue対応して」「Issue処理して」「#XX やって」「このIssueやって」などと言ったとき
argument-hint: "<issue-number>"
allowed-tools: Bash(gh issue view:*) Bash(gh issue list:*) Bash(gh issue comment:*) Bash(gh api:*) Bash(git checkout:*) Bash(git switch:*) Bash(git branch:*) Bash(npm:*) Bash(npx:*) Read Grep Glob Edit Write Agent
---

# process-issue

`$ARGUMENTS` で指定された Issue 番号の内容を読み取り、作業計画を立てて実装する。

## 手順

### 1. Issue の読み取り

```bash
gh issue view <issue-number>
```

以下を把握する:

- タイトルと本文（要件）
- ラベル（種別・フェーズ）
- 関連する Issue や ADR への参照

### 2. ブランチの作成

`docs/guides/branch-strategy.md` の命名規則に従い、Issue のラベルとタイトルからブランチを作成する。

```bash
git switch -c <branch-name>
```

### 3. 作業計画の立案

Issue の要件をもとに作業計画を立てる。計画には以下を含める:

- 変更対象のファイル・ディレクトリ
- 作業ステップの一覧
- 判断が必要な点（あればユーザーに確認）

計画をユーザーに提示し、承認を得てから実装に進む。ユーザーが「おまかせ」「進めて」と言った場合は確認をスキップしてよい。

### 4. 実装

計画に従って作業を行う。

- CLAUDE.md のコーディング規約・コミット規約に従う
- 意味のある単位でコミットする
- コミットメッセージに `#<issue-number>` を含めて Issue と紐付ける

### 5. 完了報告

作業完了後、以下をユーザーに報告する:

- 実施した変更の概要
- 作成したコミットの一覧
- 次のステップの提案（PR 作成など）

## 注意点

- **ユーザーの判断を優先する**: 要件が曖昧な場合や設計判断が必要な場合はユーザーに確認する
- **スコープを守る**: Issue に記載された範囲の作業のみ行い、関係ない改善を混ぜない
- **既存コードの理解**: 変更対象のコードを読んでから修正する
