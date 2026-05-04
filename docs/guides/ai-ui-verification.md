# AI による UI 検証ルール（Playwright MCP）

[ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) で採用した `@playwright/mcp` を Claude が UI 動作確認に使うための運用ルール。

**E2E テストフレームワークではない**。`*.spec.ts` の追加・CI への組込みは行わず、ADR-0010 の E2E 見送り方針は維持する。本 doc が扱うのは「実装中に Claude が動作確認するためのツール」としての運用基準のみ。

## 使う場面

- UI を伴う Issue（US-1〜US-5 等）の完了報告前
- WebSocket ストリーム挙動の検証（人間の手動確認では再現性が低い）
- 画面遷移を伴う動作確認

## 使わない場面

- docs / ADR / 型のみの変更
- Service 層単体の変更
- API 単独の変更（単体・統合テストで担保。`curl` は `.claude/settings.json` の deny 済みのため、API 動作確認はテストで賄う）

## 検証手順

1. 開発サーバを起動: `bun run dev`（`apps/web` + `apps/api`）
2. Playwright MCP で `localhost:5173`（`apps/web` のデフォルト。`bun run dev` 出力で確認）に navigate
3. 手順を再現し、期待状態を accessibility tree（`browser_snapshot`）または screenshot で確認
4. 完了したら dev server を停止

## 注意点

- 些末な変更で過剰検証に陥らない。型チェック・単体テストで十分な変更にはブラウザを開かない
- 任意 JavaScript 実行系（`browser_run_code_unsafe` / `browser_evaluate`）は `.claude/settings.json` の deny で禁止済み（ADR-0024 Consequences と整合）。これらに頼らずに検証する

## 関連

- [ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md): 採用根拠と DevContainer 設定
- [ADR-0010](../adr/0010-development-workflow.md): E2E 見送り判断（本 doc はその判断を変えない）
- [implement-feature skill](../../.claude/skills/implement-feature/SKILL.md) Step 4: 機能実装フローでの呼び出しポイント
- [testing.md](./testing.md): UI 動作検証の位置づけ
