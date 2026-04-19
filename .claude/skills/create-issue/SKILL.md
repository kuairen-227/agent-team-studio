---
name: create-issue
description: プロジェクト規約に沿った GitHub Issue を作成する。Issue の種別に応じたテンプレート構造で本文を生成し、適切なラベルを付与して gh issue create を実行する。
when_to_use: ユーザーが「Issue作って」「issue立てて」「チケット作って」「バグ報告して」「機能要望出して」「タスク作って」などと言ったとき
argument-hint: "[issue-type] [title-or-description]"
allowed-tools: Bash(gh issue create:*) Bash(gh issue list:*) Bash(gh issue view:*) Bash(gh label list:*) Bash(gh api:*) Read Grep
---

# create-issue

プロジェクトの規約に従って GitHub Issue を作成する。
`$ARGUMENTS` から Issue の種別とタイトル・内容を判断する。

Issue テンプレート:

```!
cat .github/ISSUE_TEMPLATE/bug.yml
cat .github/ISSUE_TEMPLATE/feature.yml
cat .github/ISSUE_TEMPLATE/decision.yml
cat .github/ISSUE_TEMPLATE/task.yml
```

## 手順

### 1. Issue 種別の判定

ユーザーの入力から Issue の種別を判定する。明示されていない場合は内容から推測し、確信が持てなければユーザーに確認する。

| 種別 | 判定キーワード例 |
| ------ | ----------------- |
| **bug** | バグ、不具合、エラー、動かない、壊れた |
| **feature** | 機能、追加、〜したい、〜できるようにする |
| **decision** | 決定、選定、方針、どうするか、ADR |
| **task** | タスク、chore、設定、整備、対応 |

### 2. コンテキストの収集

Issue の内容を充実させるために、必要に応じて以下を確認する:

- 既存の関連 Issue: `gh issue list --state open` で重複や関連がないか確認
- ADR や docs との関連: 既存の意思決定や設計ドキュメントを参照
- コードベースの状態: バグ報告の場合、関連するコードを確認

### 3. Issue 本文の生成

上記で読み込んだ種別ごとのテンプレート構造に従って本文を生成する。ユーザーが与えた情報を適切なセクションに配置し、不足している必須セクションがあればユーザーに確認する。

### 4. ラベルの選定

以下のルールに従ってラベルを付与する。

**タイプラベル（必須・1つ）**:

| 種別 | タイプラベル |
| ------ | ------------- |
| bug | `bug` |
| feature | `enhancement` |
| decision | `decision` |
| task | `chore` |

**ステータスラベル（該当時のみ）**: `status:blocked`（ブロック中の場合のみ付与。通常の進捗は open/closed で管理）

**優先度ラベル（任意）**: ユーザーが明示した場合のみ付与する — `priority:high` / `priority:low`

**その他のラベル（該当する場合）**: `documentation`, `design`, `test`

### 5. Milestone の選定

`gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.state=="open") | "\(.number): \(.title)"'` で open な Milestone 一覧を取得し、Issue が属する Milestone を判断する。

- ユーザーが明示した場合はそれを使用する
- 明示がなければ一覧を提示してユーザーに確認する
- 該当なしでも可

### 6. Issue タイトルの生成

- 日本語で、何をするか / 何が問題かを簡潔に表現する
- 動詞で終わる体言止めまたは名詞句を推奨（例:「ターゲットユーザーの定義」「ログイン画面でエラーが発生する」）
- **50文字以内**を目安にする

### 7. ユーザーへの確認

Issue を作成する前に、以下の内容をユーザーに提示して確認を取る:

- **タイトル**
- **ラベル**
- **Milestone**
- **本文**（要約または全文）
- 関連する既存 Issue があればその旨

ユーザーが「おまかせ」「そのままでいい」と言った場合は確認をスキップしてよい。

### 8. Issue 作成

```bash
gh issue create --title "<タイトル>" --body "<本文>" --label "<ラベル1>" --label "<ラベル2>" --milestone "<Milestone>" --assignee @me
```

- Milestone が未選択の場合は `--milestone` を省略する

- 作成後、Issue の URL と番号を表示する
- 関連する Issue や ADR がある場合はその旨も伝える

## 注意点

- **重複チェック**: 類似の Issue が既に存在する場合はユーザーに報告し、新規作成するか既存 Issue への追記にするか判断を仰ぐ
- **情報不足時の対応**: ユーザーの入力が曖昧な場合は、テンプレートの必須セクションを満たすために質問する。ただし過度な質問は避け、合理的に推測できる部分は埋める
- **decision Issue と ADR の関係**: decision 種別の Issue は議論・検討の場であり、結論が出たら ADR として記録する流れになる。Issue 本文にその旨を記載するとよい
