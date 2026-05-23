---
name: manage-issue
description: GitHub Issue とマイルストーンを活用したプロジェクト管理。進捗分析・優先順位付け・スコープ管理に加え、合意後は Issue セットの一括起票・親子（sub_issues）整理・マイルストーン操作・トラッカコメントまでを担う PM 視点のスキル。
when_to_use: ユーザーが「進捗確認して」「タスク整理して」「優先順位つけて」「スコープ確認して」「次何やる？」「バックログ整理して」「Issue セット作って」「フェーズ完了タスク整理して」などと言ったとき
argument-hint: "[status|prioritize|plan|scope|risk]"
context: fork
agent: pm
allowed-tools: Bash(gh issue list:*) Bash(gh issue view:*) Bash(gh issue create:*) Bash(gh issue edit:*) Bash(gh issue comment:*) Bash(gh milestone list:*) Bash(gh api repos/:owner/:repo/issues:*) Bash(gh api -X POST repos/:owner/:repo/issues:*) Bash(gh api repos/:owner/:repo/milestones:*) Bash(gh api -X PATCH repos/:owner/:repo/milestones:*) Bash(git log:*) Read Grep Glob
---

# manage-issue

PM の視点で GitHub Issue・マイルストーン全体を管理する。分析だけでなく、合意が取れた場合は Issue セットの一括起票・親子整理・マイルストーン操作までを行う。

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
gh milestone list --json number,title,state,dueOn,closedAt,openIssues,closedIssues
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

### 4. 結果の報告と次のアクション提案

分析結果を報告し、「次のアクション」を具体的に提案する。

- 結論（推奨アクション）を先に述べ、根拠を後に続ける
- 優先順位は理由付きで序列化する
- **判断はユーザーに委ねる**：勝手に Issue の変更（ラベル付与、クローズ、起票等）を行わない。提案を提示し、ユーザーが承諾した場合のみ Step 5 に進む

### 5. 構造化された Issue 操作（合意後のみ実行）

ユーザーが分析結果を踏まえて Issue 操作を承諾した場合、以下を順に実行する。

**前提（境界の判定）**:

- **単発 1 件のみ**かつ親子関係を持たない場合 → 本スキルではなく `/create-issue` に委ねるよう案内する
- **複数 Issue の起票**、**親子関係（sub_issues）を含む**、**マイルストーン description 変更を伴う**、**トラッカコメント追加を伴う** いずれかが該当する場合 → 本スキルで処理する

#### 5-1. Issue セットの設計と提示

- 各 Issue のタイトル・本文・親子関係・依存関係を表形式で提示
- ラベル・テンプレ構造・マイルストーン選定・タイトル文体の規約は **`/create-issue` SKILL.md を SSoT** として参照する（本スキル内で重複定義しない）
- 提示後、ユーザーに **1 回でまとめて確認** を求める（件数が多くても 1 回で済ます）

#### 5-2. 一括起票

ユーザー承諾後、規約に従って Issue を起票する。`/create-issue` の手順 4〜6（ラベル選定 / マイルストーン選定 / タイトル文体）と同じ規約を適用する。

```bash
gh issue create --title "<タイトル>" \
  --body "$(cat <<'EOF'
<本文>
EOF
)" \
  --label "<ラベル>" \
  --milestone "<Milestone>"
```

親子関係がある場合は次のいずれかで対応：

- **(a) 子先・親後**：子 Issue を先に起票して番号を取得し、親 Issue を子番号入りで起票
- **(b) 親先・後で更新**：親 Issue を「子 Issue（後続で追記）」プレースホルダで起票し、子起票後に `gh issue edit <parent>` で本文を更新。`gh issue edit` が失敗した場合はプレースホルダが残るため、必ず手動で `gh issue edit <parent> --body "..."` を再実行する

#### 5-3. 親子関係（sub_issues）登録【必須】

**重要**：親 Issue 本文の `- [ ] #N` 形式の task list は **見た目のみ**であり、GitHub のデータモデル上の親子関係（sub_issues）にはならない。必ず以下の API で登録する。

**`gh api` 呼び出しの注意**：本スキルの Bash 権限は `repos/:owner/:repo/...` という **placeholder 形式** のコマンドに対してのみ narrow に許可されている。`repos/<実リポジトリ名>/...` のように literal で書くと settings.json のパターンに一致せず、毎回パーミッションプロンプトが発生する。**必ず `:owner/:repo` 形式で書く**（gh CLI が実行時に現在のリポジトリへ解決する）。

```bash
# 子 Issue の内部 ID を取得（番号ではない、.id フィールド）
gh api repos/:owner/:repo/issues/<child-number> --jq '.id'

# 親に sub-issue として登録（-F で integer 渡し、-f は文字列扱いで 422 になる）
gh api -X POST repos/:owner/:repo/issues/<parent-number>/sub_issues \
  -F sub_issue_id=<child-id>
```

**よくあるミス**：

- `-f sub_issue_id=...` を使うと API が `"Invalid property /sub_issue_id: ... is not of type integer"` で 422 を返す。**必ず `-F`**
- task list の `- [ ] #N` だけで満足してしまう。sub_issues API を呼ばないと親子は成立しない

#### 5-4. 検証【必須】

```bash
# 親 Issue の sub-issues 一覧を確認
gh api repos/:owner/:repo/issues/<parent>/sub_issues --jq '.[] | "  #\(.number): \(.title)"'

# 件数が期待値と一致することを確認
gh api repos/:owner/:repo/issues/<parent>/sub_issues --jq 'length'
```

期待件数と一致しない場合は、**既登録 ID との差分を取って未登録分のみを 5-3 で POST する**。既登録 ID へ再 POST すると 422 を返すため、必ず差分計算してから実行する。

```bash
# 既登録の sub_issue ID 一覧を取得
gh api repos/:owner/:repo/issues/<parent>/sub_issues --jq '[.[].id]' > registered.json

# 起票済み全子 Issue の ID 一覧を取得
for n in <child-numbers>; do
  gh api repos/:owner/:repo/issues/$n --jq '.id'
done > all_children.txt

# 差分（未登録 ID）を抽出して、それぞれを 5-3 の手順で POST
# jq などで `all_children.txt - registered.json` を計算する
```

#### 5-5. マイルストーン description 更新（必要な場合）

```bash
# マイルストーン番号を取得
gh api repos/:owner/:repo/milestones --jq '.[] | select(.title | contains("<keyword>")) | {number, title}'

# description を更新
gh api -X PATCH repos/:owner/:repo/milestones/<number> \
  -f description='<new description>'
```

#### 5-6. トラッカコメント（必要な場合）

スコープ拡張や Issue 群の追加を既存のトラッカ Issue に通知する：

```bash
gh issue comment <tracker-number> --body "$(cat <<'EOF'
## <件名>

<本文>
EOF
)"
```

## 注意点

横断軸（判断はユーザーに委ねる・過剰な管理を避ける等）は [設計・開発原則](../../../docs/principles/README.md) を参照。

manage-issue 固有の注意点:

- **データに基づく**: 推測ではなく Issue の実データを根拠にする
- **規約は /create-issue が SSoT**: Issue の本文構造・ラベル・マイルストーン選定・タイトル文体は `/create-issue` SKILL.md を参照し、本スキル内で重複定義しない
- **gh api コマンドは `:owner/:repo` 形式で書く**: settings.json の Bash 権限は placeholder 形式に対してのみ narrow に許可されている。literal で書くとパターン不一致でプロンプトが出る
- **単発 Issue は /create-issue に委譲**: 1 件のみで親子関係も伴わない場合は `/create-issue` を使うようユーザーに案内する
- **sub_issues 登録を忘れない**: 親子関係を含む Issue セットを起票したら、必ず Step 5-3 と 5-4 を実行する。Task list の `- [ ] #N` は見た目だけで親子関係ではない
- **承諾の境界**: 分析結果の提案・承諾フローを 1 回挟むこと。15 件起票でユーザー確認 1 回というように、まとめて確認する設計にする
