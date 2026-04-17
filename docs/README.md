# ドキュメント

プロジェクトのドキュメントを管理するディレクトリです。

## ディレクトリ構成

| ディレクトリ | 内容 | 対応フェーズ |
| --- | --- | --- |
| [requirements](./requirements/README.md) | 要件定義書 | 要件定義 |
| [design](./design/README.md) | 設計ドキュメント | 設計 |
| [adr](./adr/README.md) | Architecture Decision Records（意思決定記録） | 全フェーズ |
| [guides](./guides/README.md) | 運用ガイド（ブランチ戦略、GitHub 運用等） | 全フェーズ |

## 開発ライフサイクルとの対応

| フェーズ | 主な管理場所 |
| --- | --- |
| 企画 | GitHub Issue（`requirement` ラベル） |
| 要件定義 | GitHub Issue + `requirements/` |
| 設計 | `design/` + 対応 Issue からリンク |
| 開発・試験 | GitHub Issue + PR |
| 改善・運用保守 | GitHub Issue + PR |
| 意思決定（全フェーズ） | `adr/`（規模を問わず記録） |
