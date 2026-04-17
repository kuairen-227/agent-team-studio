# GitHub 運用ガイド

このプロジェクトにおける GitHub の運用方針をまとめたドキュメントです。

## Issue 運用

### テンプレート

| テンプレート | 用途 | 自動付与ラベル |
| --- | --- | --- |
| Feature Request | 新機能の提案 | `enhancement` |
| Bug Report | バグの報告 | `bug` |
| Task | タスク・メンテナンス作業 | `chore` |
| Decision Record | 意思決定の記録 | `decision` |

テンプレートを使わない blank issue も作成可能です。

### Issue 作成時のルール

1. テンプレートを選択して必須項目を埋める
2. **タイプラベル**が自動付与される。必要に応じてステータスラベル・優先度ラベルを追加する
3. 該当するマイルストーンがあれば紐づける

## ラベル体系

### タイプラベル

| ラベル | 色 | 用途 |
| --- | --- | --- |
| `bug` | 赤 | バグ |
| `enhancement` | 水色 | 新機能・改善 |
| `documentation` | 青 | ドキュメント |
| `chore` | 黄 | メンテナンス・設定・ツーリング |
| `design` | 紫 | 設計・アーキテクチャ |
| `decision` | 薄紫 | 意思決定記録 |
| `test` | 薄青 | テスト関連 |

### ステータスラベル

Issue の現在の状態を示します。

| ラベル | 用途 |
| --- | --- |
| `status:backlog` | 未着手・優先度未定 |
| `status:ready` | 着手可能 |
| `status:in-progress` | 作業中 |
| `status:blocked` | ブロック中 |
| `status:review` | レビュー待ち |

### 優先度ラベル

| ラベル | 用途 |
| --- | --- |
| `priority:high` | 優先的に対応 |
| `priority:low` | 余裕があるときに対応 |

優先度ラベルは任意です。付けない場合は通常優先度とみなします。

## Pull Request 運用

1. 作業ブランチから PR を作成する（ブランチ命名は [branch-strategy.md](./branch-strategy.md) を参照）
2. PR テンプレートの What / Why / How を記入する
3. `closes #XX` で対応する Issue を紐づける
4. squash merge でマージする
5. マージ後、ブランチを削除する

## マイルストーン運用

- マイルストーンはリリース単位で作成する（例: `v0.1 - Project Setup`）
- Issue 作成時に該当するマイルストーンを紐づける
- 区切りのよいタイミングでマイルストーンをクローズする
- 新しいマイルストーンは必要に応じて追加する
