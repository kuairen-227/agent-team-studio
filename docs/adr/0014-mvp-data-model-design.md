# 0014. MVP データモデル設計方針

## Status

accepted

- 作成日: 2026-04-22
- 関連: ADR-0005（前提・テンプレート概念モデル）, ADR-0009（前提・レイヤー構成）, ADR-0013（前提・ドキュメント配置ポリシー）, Issue #52

## Context

ADR-0005 で MVP Hero UC（競合調査の並列深掘り）とテンプレート概念モデルが確定し、ADR-0009 で `packages/db` を中心とするレイヤー構成が定まった。MVP 実装着手前に、Template / Execution / エージェント実行状態 / 成果物の 4 つをドメインモデルとしてどう構造化するかを決める必要がある。

具体的には以下の 4 論点を確定する:

1. 個別エージェントの実行状態をどこで持つか（Execution 内に集約 vs 独立エンティティ）
2. 実行結果（Markdown / 構造化 JSON）をどこで持つか（Execution に inline vs 独立エンティティ）
3. Template 定義のバージョン管理（スキーマ進化への対応）
4. Execution の入力パラメータをどう持つか（テンプレート固有フィールド追加 vs 構造化属性）

本 ADR は 4 論点をまとめて判断する。実際のエンティティ構造・属性・状態遷移・JSON 構造の仕様は [data-model.md](../design/data-model.md) を参照。

## Considered Alternatives

### 1. エージェント単位の実行状態

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 独立エンティティ `AgentExecution`（Execution 1:N AgentExecution） | **採用** — US-3 のエージェント単位ステータス表示、US-4 の Integration 失敗時の個別結果閲覧、ストリーミング中の部分更新の全てを素直に扱える |
| B | Execution に構造化属性として埋め込む（`Execution.agents: AgentStatus[]`） | 却下 — ストリーミング中のステータス遷移のたびに構造化属性の全置換が必要。個別エージェントの出力保存先が曖昧になる |

### 2. 実行結果（Result）の保持

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 独立エンティティ `Result`（Execution 1:0..1 Result） | **採用** — ドメイン観点で「実行プロセス」と「成果物」は別概念。Integration Agent が正常完了した場合のみ Result が存在するという意味論を自然に表現できる。US-4 の失敗時要件（Result 不在として表現）、US-5 履歴一覧での軽量取得にも整合 |
| B | Execution に `result_markdown` / `result_structured` を inline | 却下 — プロセス状態と成果物が 1 エンティティに同居。完了前は NULL 列が混在し意味論が曖昧。履歴一覧で重量データを引かない設計が SELECT 列指定に依存する |

### 3. Template 定義のバージョン管理

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `Template.definition` 内に `schema_version` を保持。エンティティレベルの `version` 属性は設けない | **採用** — プロンプト改訂履歴は git / シードスクリプトで管理。将来 `TemplateDefinition` スキーマが進化した際に `schema_version` でマイグレーションロジックを書ける。ユーザーによるテンプレート作成・編集は v2 のためレコード単位バージョニングは不要 |
| B | Template エンティティに `version` 属性を追加 | 却下 — MVP で必要になる具体的要件（ユーザー編集・版管理）が存在しない。v2 で必要になった時点で追加すれば YAGNI と整合 |

### 4. Execution の入力パラメータ

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `Execution.parameters` を構造化属性としてテンプレート固有入力を格納 | **採用** — テンプレート増加時に Execution スキーマを変えずに済む。バリデーションは `Template.definition.input_schema`（JSON Schema）で実行時検証 |
| B | テンプレート固有の属性を Execution エンティティに追加 | 却下 — テンプレート追加のたびにスキーマ変更が必要。MVP は 1 テンプレートだが v2 以降の拡張性を考えると構造化属性が妥当 |

## Decision

以下の構造を採用する。詳細な属性・状態遷移・JSON 構造は [data-model.md](../design/data-model.md) を参照。

- **AgentExecution を独立エンティティとする**（Execution 1 : N AgentExecution）。`status` / `output` / `error_message` / `started_at` / `completed_at` を保持
- **Result を独立エンティティとする**（Execution 1 : 0..1 Result）。Integration Agent が `completed` に到達した場合のみ生成。`markdown` と `structured` の 2 属性で同一内容を別表現で保持
- **Template.definition 内に `schema_version` を保持**し、エンティティレベルのバージョン属性は設けない
- **Execution.parameters を構造化属性とし**、テンプレート固有入力の格納先とする

## Consequences

### ポジティブ

- エージェント単位の状態管理が容易になり、WebSocket 経由のストリーミングステータス更新が単一エンティティの部分更新で済む
- 「実行プロセス」と「成果物」の分離が意味論的に正確で、US-4 失敗時 UX（Integration 失敗 → Result 不在）を自然に表現できる
- 履歴一覧（US-5）で Execution のメタデータのみを軽量に取得でき、Markdown レポートを伴わない
- テンプレート拡張性が `Execution.parameters` に閉じ、新テンプレート追加時にエンティティスキーマ変更が不要

### ネガティブ / リスク

- エンティティ 2 本増（AgentExecution / Result）による実装コストの増加。リポジトリレイヤー・関連付けクエリの追加が必要（MVP 実装 Issue で対応）
- Integration Agent の出力が `AgentExecution.output`（実行トレース用）と `Result.structured`（成果物用）に論理的に重複する。MVP では許容し、コードコメント・data-model.md §8 で責務の違いを明記する
- `Template.definition` に `schema_version` を持たせたが、スキーマ進化時のマイグレーションロジックは未整備。実装フェーズで最初のマイグレーションが必要になった時点で設計する

### 中立

- 部分失敗時の `Execution.status` を 2 値（`completed` / `failed`）に集約するか `partial_failure` を追加するかは A4（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）で確定する。本 ADR のモデルは enum 拡張のみで対応可能
- 物理スキーマ（テーブル分割・ID 形式・インデックス・FK ポリシー）は MVP 実装 Issue で `packages/db/` 配下に具体化する
- v2 でテンプレートのユーザー作成・編集を追加する際、`Template` にバージョン属性を追加する意思決定が別途必要になる（ADR-0014 のスコープ外）
