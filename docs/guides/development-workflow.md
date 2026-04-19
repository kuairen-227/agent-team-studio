# 開発ワークフロー

型駆動 + 軽量 TDD による実装フロー。AI駆動開発の枠組み（[ADR-0007](../adr/0007-ai-driven-dev-architecture.md)）の中で運用する。

採用の背景・理由は [ADR-0010](../adr/0010-development-workflow.md) を参照。

## 実装ワークフロー（1 Issue の流れ）

1. **型定義（Type-First）** — `packages/shared` にドメイン型・API 型を定義（チェックポイント: 人間確認）
2. **テスト作成** — Service 層のテストを先に書く。BDD 的な記述スタイル（`describe`/`it` で振る舞いを表現）を推奨
3. **実装** — Repository → Service → Route の順
4. **リファクタリング** — テストが通り続けることを確認
5. **統合確認 + PR** — lint + type-check + test

## テスト戦略

| 層 | 対象 | テスト方法 |
| --- | --- | --- |
| 単体テスト | Service 層 | Repository モック、Bun test |
| 統合テスト | Route 層 | Hono `app.request()` + テスト用 DB |
| E2E | MVP では見送り | 画面 3 つ、手動確認で十分 |

- テストファイル配置: co-location（テスト対象と同ディレクトリ）
- カバレッジ目標: 数値ではなく「Service 層は必ずテストを書く」ルール
