# 0030. `/manage-task` スキルを `/manage-issue` に改称し、Issue 構造化操作までを担う

## Status

accepted

- 作成日: 2026-05-23
- 関連: ADR-0011（前提）, Issue #198 / #199 等（運用で表面化した事例）

## Context

ADR-0011 で「ロールベースエージェント + 活動別スキル（`/manage-task`, `/review`）」の構成を採用した。`/manage-task` は PM 視点の **分析専用**（読み取り専用、Issue 変更を行わない）として設計され、status / prioritize / plan / scope / risk の 5 サブコマンドを提供している。

運用するうちに以下が顕在化した：

1. **用語衝突**: スキル名の "task" が `task.yml`（chore 用 Issue テンプレート）と紛らわしい。実態は Issue・マイルストーン管理であり、「タスク」より「Issue」の方が責務を正確に表す。
2. **分析直後の動線が貧弱**: 分析を経て「ではこの Issue セットを起票しよう」となった際、`/manage-task` は読み取り専用のため起票できず、`/create-issue` を 15 回呼ぶことになる。`/create-issue` は単発前提で毎回ユーザー確認を求めるため、件数が増えるほどフリクションが累積する。
3. **構造化操作の置き場が無い**: 親子関係（GitHub の sub_issues 機能）の登録、マイルストーン description の更新、トラッカ Issue へのスコープ拡張コメント追加など、Issue 単体の枠を超えた構造化操作の責務が、`/manage-task` にも `/create-issue` にも属さず宙に浮いていた。
4. **sub_issues API の落とし穴**: 親 Issue 本文の task list `- [ ] #N` は **見た目だけ** で GitHub のデータモデル上の親子関係にはならない。`POST /repos/.../sub_issues` で明示登録する必要があるが、その手順が skill に文書化されていないと毎回見落とすリスクがある（実運用で確認）。

## Considered Alternatives

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `/manage-task` のまま、機能だけ拡張 | 却下 — 名前の用語衝突と責務の不一致が残る。新規利用者が混乱する |
| B | `/manage-issue` にリネーム + 構造化 Issue 操作までを責務に追加 | **採用** — 名前が責務を表し、`/create-issue`（単発）との対称性が明確になる |
| C | 新スキル `/structure-issues` 等を分離（3 スキル構成） | 却下 — ADR-0011 の「活動別スキル」方針からスキル数を増やすほどの責務分離は無く、利用者側の認知負荷が上がる |

### 規約 SSoT の置き場

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `/create-issue` SKILL.md が規約 SSoT。`/manage-issue` から参照する | **採用** — 規約の重複定義を避けられ、`/create-issue` を読めば Issue 規約が把握できる |
| B | `docs/guides/issue-conventions.md` を切り出して両スキルから参照 | 却下 — 規約は `/create-issue` の主目的そのものであり、外出しすると逆に分散する |

### サブコマンドの追加

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 新サブコマンド `structure` 等を追加 | 却下 — 既存サブコマンド（特に `plan` や `status`）の「次のアクション」として自然に派生するため、独立コマンド化は冗長 |
| B | 既存サブコマンドの結果報告フローに「合意後の構造化操作」ステップ（Step 5）を追加する | **採用** — 分析と操作が連続したフローで一気通貫になる |

## Decision

`/manage-task` を `/manage-issue` にリネームし、責務を「分析のみ」から「**分析 + 合意後の構造化 Issue 操作**」に拡張する。

### 責務の境界（`/create-issue` との関係）

| スキル | 責務 | 書き込み権限 |
| --- | --- | --- |
| **`/manage-issue`**（本 ADR で改称） | プロジェクト全体の Issue・マイルストーン管理。分析（status / prioritize / plan / scope / risk）＋ 合意後の構造化操作（複数 Issue 一括起票、親子関係 sub_issues 登録、マイルストーン description 更新、トラッカコメント追加） | 読み取り + 構造化書き込み |
| **`/create-issue`** | 単発 Issue の起票。Issue 規約（テンプレ構造・ラベル・マイルストーン選定・タイトル文体）の SSoT | 書き込み（1 件） |

利用者から見た振り分け：

- 1 件のみ・親子関係なし → `/create-issue`
- 複数件 / 親子関係あり / マイルストーン description 更新を伴う / トラッカコメントを伴う → `/manage-issue`

`/manage-issue` は規約 SSoT を持たない。一括起票時は `/create-issue` SKILL.md の規約セクションを参照する。

### `/manage-issue` のフロー

1. サブコマンドの判定（status / prioritize / plan / scope / risk。引数なしは status）
2. データ収集（gh issue list、gh milestone list 等）
3. 分析の実行
4. 結果の報告と次のアクション提案
5. **構造化された Issue 操作（合意後のみ）** — 5-1 設計と提示 → 5-2 一括起票 → 5-3 sub_issues 登録【必須】→ 5-4 検証【必須】→ 5-5 マイルストーン description 更新 → 5-6 トラッカコメント

Step 5-3 と 5-4 は sub_issues API の落とし穴（task list は親子にならない、`-f` ではなく `-F` で integer 渡し）を skill 内に明示し、見落としを防ぐ。

### 付随する修正

- `.claude/skills/manage-task/` → `.claude/skills/manage-issue/` にディレクトリ rename
- `.claude/skills/manage-issue/SKILL.md` を改訂（responsibilities 拡張、Step 5 追加）
- `.claude/skills/create-issue/SKILL.md` に `/manage-issue` への振り分け案内とクロスリファレンスを追加
- `.claude/settings.json` の `permissions.allow` を更新：
  - `Skill(manage-task)` → `Skill(manage-issue)`
  - `Bash(gh issue edit:*)` を追加
  - `Bash(gh api repos/:owner/:repo/issues:*)` / `Bash(gh api -X POST repos/:owner/:repo/issues:*)` を追加（sub_issues 操作）
  - `Bash(gh api repos/:owner/:repo/milestones:*)` / `Bash(gh api -X PATCH repos/:owner/:repo/milestones:*)` を追加（マイルストーン操作）
  - `gh api:*` のような広い許可は採用しない（destructive な repo 設定変更や orgs/admin への到達を防ぐため）

ADR-0011 本体は historical record として更新せず、本 ADR で差分を記録する。

## Consequences

### ポジティブ

- スキル名が責務を正確に表すようになり、`task.yml` Issue テンプレートとの用語衝突が解消される
- 「分析 → 提案 → 合意 → 一括起票 → 親子整理 → マイルストーン更新 → トラッカ通知」が 1 スキルで一気通貫になり、フェーズ完了時の Issue 棚卸し作業（v1.0 MVP 完了タスク整理など）が現実的なフリクションで回せる
- 規約 SSoT を `/create-issue` に集約することで、両スキル間の重複定義リスクが消える
- `/manage-issue` 内に sub_issues API の落とし穴を明文化することで、再発しやすいミス（task list で満足する / `-f` で 422 になる）を構造的に防止できる
- Bash 権限を narrow に絞ったため、`gh api:*` のような広い許可と比べて destructive リスクが小さい

### ネガティブ / リスク

- ADR-0011 の記述（`/manage-task` という名前、スキル責務）が historical 記述になる。読者は本 ADR との突き合わせが必要
- スキルの責務が肥大化しすぎないか、運用で監視が必要。とくに Step 5 の構造化操作が「ユーザー合意のステップを 1 回挟む」を遵守しているか
- sub_issues API はまだ GitHub 側で進化中。仕様変更があった場合、SKILL.md の Step 5-3 / 5-4 の更新が必要

### 中立

- スキル数は ADR-0011 と同じ 2（`/manage-issue`, `/review`）で変化なし
- 責務の境界が明確になった反面、「複数件かどうか」「親子があるか」を都度判定する必要があり、利用者は最初は迷うかもしれない（用語衝突よりは小さい摩擦）
