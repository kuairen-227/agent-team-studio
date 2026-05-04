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
- テストの判定軸（価値あるテストとは何か / 業界標準用語 / アンチパターン）: [テスト原則](../principles/testing.md) を参照

### AI による UI 検証ルール（Playwright MCP）

UI 実装中に Claude が動作確認を行うための指針。`@playwright/mcp`（[ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md)）が `.mcp.json` 経由で利用可能。**E2E テストフレームワークではない**ため、`*.spec.ts` の追加・CI への組込は行わず、ADR-0010 の E2E 見送り方針は維持する。

- **使う**: UI を伴う Issue（US-1〜US-5 等）の完了報告前 / WebSocket ストリーム挙動の検証 / 画面遷移を伴う動作確認
- **使わない**: docs / ADR / 型のみの変更 / Service 層単体の変更 / API 単独の変更（curl で十分）
- **検証手順**: `bun run dev`（`apps/web` + `apps/api`）→ Playwright MCP で `localhost:5173`（`apps/web` のデフォルト。`bun run dev` の出力で確認）を開き手順を再現 → 期待状態のスクリーンショットまたはアクセシビリティツリーで確認
- **注意**: 些末な変更で過剰検証に陥らないこと。型チェック・単体テストで十分な変更にはブラウザを開かない

### テストフィクスチャ配置方針

- **co-location を基本とし、共有用フォルダは作らない**: フィクスチャは利用するテストと同じディレクトリの `*.test.ts` 内（インライン）または同ディレクトリの `__fixtures__/` に置く。`tests/` や `test/fixtures/` のような最上位フォルダは作らない（テスト対象との関係が読み取れなくなるため）
- **Service テストの Repository モック**: 関数注入（`createXxxService({ ... })`）した repo 関数をテスト内で `async () => fixture` 等のインラインモックに差し替える。MSW や jest mocks のような重量級ツールは MVP では導入しない
- **Route 層 (`app.request()`) の統合テスト**: app の構築を `createApp(deps)` 関数で関数化し、テストでは fake repo を渡して DB 不要で Hono の route → service → repo を貫通させる。テスト用 DB を立ち上げる方式は I/O が重いため MVP では採用せず、必要が確定した時点（CRUD が増え DB 制約検証が要る US-2 以降）で testcontainers 等を再検討する
- **ひな型の参照先**: `apps/api/src/services/templates.test.ts`（service 単体）と `apps/api/src/app.test.ts`（route 統合）を最小サンプルとする
