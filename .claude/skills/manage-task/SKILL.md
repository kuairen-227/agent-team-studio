---
name: manage-task
description: GitHub Issue とマイルストーンを活用したタスク管理。進捗整理、優先順位付け、スコープ管理、リスク分析を PM の視点で行う。
when_to_use: ユーザーが「進捗確認して」「タスク整理して」「優先順位つけて」「スコープ確認して」「次何やる？」「バックログ整理して」などと言ったとき
argument-hint: "[status|prioritize|plan|scope|risk]"
context: fork
agent: pm
allowed-tools: Bash(gh issue list:*) Bash(gh issue view:*) Bash(gh api:*) Bash(gh milestone list:*) Bash(git log:*) Read Grep Glob
---

# manage-task

PM の視点で GitHub Issue・マイルストーンを分析し、タスク管理を行う。

`$ARGUMENTS` からサブコマンドを判定する。引数がない場合は `status` として扱う。

## 手順

### 1. サブコマンドの判定

`$ARGUMENTS` からサブコマンドを判定する。明示されていない場合は `status` として扱う。

| 引数 | サブコマンド |
| ------ | ----------- |
| `status` / 引数なし | 進捗概況 |
| `prioritize` | 優先順位付け |
| `plan` | イテレーション計画 |
| `scope` | スコープ分析 |
| `risk` | リスク分析 |

### 2. データの収集

サブコマンドに応じて必要なデータを GitHub から取得する。

```bash
# 共通: open Issue 一覧
gh issue list --state open --json number,title,labels,milestone,createdAt,updatedAt

# status: 直近クローズ分
gh issue list --state closed --json number,title,closedAt --limit 10

# 共通: マイルストーン一覧
gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.state=="open")'
```

scope の場合は MVP スコープ定義も読み込む:

```!
cat docs/adr/0005-mvp-scope.md
```

### 3. 分析の実行

サブコマンドに応じた分析を行う。

**status（進捗概況）**:

1. マイルストーン別の進捗（open / closed Issue 数）を集計
2. `status:blocked` ラベルが付いた Issue を抽出
3. 直近 1 週間にクローズされた Issue を列挙
4. open Issue の総数と傾向をまとめる

**prioritize（優先順位付け）**:

1. 各 Issue の内容を確認する
2. 以下の観点で評価する:
   - **依存関係**: 他 Issue のブロッカーになっているか
   - **リスク**: 技術的不確実性、早期検証の必要性
   - **工数**: クイックウィンの可能性
   - **期限**: マイルストーンの期限が近いか
3. 順序付きリストで優先順位を提示する（理由付き）

**plan（イテレーション計画）**:

1. open Issue の状態と依存関係を分析する
2. 直近で取り組むべき Issue セットを提案する
3. 提案の根拠（依存関係、リスク、工数）を説明する

**scope（スコープ分析）**:

1. open Issue が MVP スコープ（ADR-0005）内か判定する
2. スコープクリープの兆候がないか確認する
3. MVP スコープ外に分類すべき Issue があれば指摘する
4. 「あると便利」vs「ないと検証できない」を判定する

**risk（リスク分析）**:

1. `status:blocked` の Issue とブロック要因を特定する
2. 長期間 open のままの Issue（停滞の兆候）を抽出する
3. 依存関係が多い Issue（ボトルネックリスク）を特定する
4. マイルストーンの期限に対する進捗のずれを評価する
5. リスクごとに影響度と対策を提示する

### 4. 結果の報告

分析結果を報告し、「次のアクション」を具体的に提案する。

- 結論（推奨アクション）を先に述べ、根拠を後に続ける
- 優先順位は理由付きで序列化する
- ユーザーに判断を仰ぐ（勝手に Issue の変更を行わない）

## 注意点

- **判断はユーザーに委ねる**: 分析と選択肢の提示に留め、勝手に Issue の変更（ラベル付与、クローズ等）を行わない
- **過剰な管理を避ける**: 1人+AI チームに不要な粒度の分析をしない
- **データに基づく**: 推測ではなく Issue の実データを根拠にする
