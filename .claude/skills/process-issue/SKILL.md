---
name: process-issue
description: GitHub Issue の内容を読み取り、作業計画を立てて実装を行う。Issue 番号を引数に指定する。
when_to_use: ユーザーが「Issue対応して」「Issue処理して」「#XX やって」「このIssueやって」などと言ったとき
argument-hint: "<issue-number>"
allowed-tools: Bash(gh issue view:*) Bash(gh issue list:*) Bash(gh issue comment:*) Bash(git checkout:*) Bash(git switch:*) Bash(git branch:*) Read Grep Glob Edit Write Agent Skill
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

### 4. 実装フェーズの振り分け

Issue のラベルから実装フェーズの進め方を決める:

| ラベル | 適用 skill | 進め方 |
| --- | --- | --- |
| `enhancement` / `bug` | [implement-feature](../implement-feature/SKILL.md) | type-first + テストファーストの手順を強制（Step 0 で型差分確認 → RED → GREEN → ...） |
| `chore` / `documentation` / `decision` | 本 skill 単独で続行 | 計画に従って直接実装する。テストファーストは適用外 |

判定が曖昧なケース（コード変更を含む chore 等）はユーザーに確認する。

### 5. 実装

#### 5a. enhancement / bug の場合

`implement-feature` skill を呼び出す。引き継ぐ情報:

- Issue 番号
- Step 3 で合意した計画の全文（変更対象ファイル / 作業ステップ / 判断ポイント）

`implement-feature` 側は計画を受領済みとして Step 0 の型差分確認から開始する（再 `gh issue view` は不要）。

#### 5b. chore / documentation / decision の場合

計画に従って直接作業する:

- CLAUDE.md のコーディング規約・コミット規約に従う
- 意味のある単位でコミットする
- コミットメッセージに `#<issue-number>` を含めて Issue と紐付ける

完了前に最低限の品質確認を行う:

- 常に: `bun run lint:md && bun run lint:secret`
- コードまたは設定に変更がある場合: 加えて `bun run lint && bun run type-check && bun run test && bun run build`

### 6. 完了報告

作業完了後、以下をユーザーに報告する:

- 実施した変更の概要
- 作成したコミットの一覧
- 次のステップの提案（PR 作成など）

## 注意点

横断軸（ユーザー判断優先・スコープ厳守等）は [設計・開発原則](../../../docs/principles/README.md) を参照。

process-issue 固有の注意点:

- **既存コードの理解**: 変更対象のコードを読んでから修正する
- **skill 連携の一貫性**: `implement-feature` に引き継ぐ場合、計画は本 skill のステップ 3 で確定させてから渡す（implement-feature は Step 0 で型差分確認に専念できる状態にする）
