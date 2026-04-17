# Architecture Decision Records (ADR)

アーキテクチャに関する重要な意思決定を記録するディレクトリです。

## ADR とは

ADR は、アーキテクチャ上の重要な決定とその背景・理由・結果を記録する軽量なドキュメントです。Michael Nygard のフォーマットに基づいています。

## ADR 一覧

| # | タイトル | ステータス | 日付 |
| --- | --------- | ----------- | ------ |
| [0001](./0001-record-architecture-decisions.md) | ADR を用いてアーキテクチャの意思決定を記録する | accepted | 2026-04-17 |
| [0002](./0002-project-scenario.md) | プロジェクトの前提・状況設定 | accepted | 2026-04-17 |
| [0003](./0003-product-concept.md) | プロダクトコンセプト | accepted | 2026-04-17 |
| [0004](./0004-target-users.md) | ターゲットユーザー | accepted | 2026-04-17 |

## 新しい ADR の作成方法

1. [template.md](./template.md) をコピーする
2. 連番でファイル名を付ける（例: `0002-choose-database.md`）
3. 各セクションを記入する
4. この README の一覧表に追加する
