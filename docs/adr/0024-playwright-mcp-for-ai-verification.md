# 0024. Playwright MCP を AI による UI 検証ツールとして採用

## Status

accepted

- 作成日: 2026-05-04
- 関連: [ADR-0010](./0010-development-workflow.md)（前提：E2E は見送り）, [ADR-0016](./0016-devcontainer-integration.md)（前提：DevContainer 統合。ADR-0018 は compose 構成のみが対象であり、postCreate の判断は ADR-0016 が引き続き有効）, Issue #116, Issue #123

## Context

Walking Skeleton（PR #114, Issue #82）の完了で `apps/web` がブラウザで触れる状態になり、Issue #116 を起点に MVP 機能実装フェーズ（US-1〜US-5）が始まる。テンプレート選択・パラメータ入力・リアルタイム進捗・結果表示・履歴一覧と、UI とインタラクションが実装の中心となる。

CLAUDE.md（システム標準ガイダンス）には「For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete」とあるが、現状 `.mcp.json` には context7 のみ有効で、Claude がブラウザを駆動する手段がない。型チェックと単体テストが通っただけで完了報告されるリスクがあり、特に US-3 の WebSocket ストリーム挙動は人間による手動確認も再現性が低い。

ADR-0010 では「E2E は MVP では見送り（3 画面、手動確認で十分）」と決定済で、本 ADR はこの判断を**変更しない**。本 ADR で扱うのは「実装中に Claude が動作確認するためのツール」であり、リグレッション防止のための自動テストフレームワーク採否とは別問題である。

## Considered Alternatives

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 手動確認のみ維持（ADR-0010 既定） | 却下 — AI による完了報告の信頼性確保が困難。US-3 のストリーム挙動は人間の手動確認でも再現性が低く、実装サイクルの精度が落ちる |
| B | Playwright を E2E フレームワークとして導入（spec + CI 組込） | 却下 — ADR-0010 の見送り判断と抵触。3 画面でのメンテコスト・flaky 対応コストが過大。本 Issue は AI 検証手段の整備で、E2E 採否は別議論 |
| C | Claude Code 公式 Plugin（`playwright@claude-plugins-official`）経由で導入 | 却下 — 中身は `@playwright/mcp` のみで `.mcp.json` 方式と機能等価。既存 context7 とのスタイル統一を優先。Plugin 化は将来 skill / agent が同梱されるなど機能差が出た時点で再検討 |
| D | `.mcp.json` に `@playwright/mcp` を追加 | **採用** — 既存 context7 と同じ JSON 直書きスタイル、最小変更、リポジトリにコミットしてチームで共有可能。`spec` / CI には載せないため ADR-0010 と独立 |

## Decision

### 1. `@playwright/mcp` を `.mcp.json` に追加する

`.mcp.json` の `mcpServers` に `playwright` エントリを追加し、`npx -y @playwright/mcp@latest` で起動する。`.claude/settings.json` の `enabledMcpjsonServers` と `permissions.allow` にも反映する。

### 2. spec ファイルや CI 組込は行わない

本 ADR の範疇は AI 検証ツールに限定する。`*.spec.ts` の追加、`bun run test` への E2E 組込、CI ワークフローへの追加は行わない。ADR-0010 の E2E 見送り判断は無影響で維持する。

### 3. DevContainer の Chromium 依存

`@playwright/mcp` の起動にはブラウザバイナリと Linux system 依存パッケージが必要だが、DevContainer 内では不足することがある。`.devcontainer/post-create.sh` に以下の 2 コマンドを追記し、リビルド時に確実に揃える。`install-deps` は apt パッケージ操作のため sudo が必要、ブラウザ取得はユーザー home 配下への書き込みなので sudo 不要、と権限境界を分離する。

なお `@playwright/mcp` の `--browser` 既定値は `chrome` チャンネル（システム Google Chrome at `/opt/google/chrome/chrome`）で、DevContainer には存在しない。`--browser chromium` を `.mcp.json` の args に明示すると Playwright バンドル相当（実体は **Chrome for Testing** = `chromium-headless-shell`）に切り替わるため、こちらを採用する。`@playwright/mcp install-browser chrome-for-testing` で取得され `~/.cache/ms-playwright/chromium_headless_shell-*` に展開される。`playwright install chromium` は別ディレクトリ（`chromium-*`）の bundled chromium を入れるが、`@playwright/mcp` が `--browser chromium` で参照するのは `chromium-headless-shell` の方のため、`install-browser chrome-for-testing` を使う。system 依存は両者で共通のため `playwright install-deps chromium` で賄える。

```bash
sudo npx --yes playwright install-deps chromium
npx --yes @playwright/mcp@latest install-browser chrome-for-testing
```

ADR-0016 の DevContainer 統合方針には抵触しない（features 追加なし、postCreate の拡張のみ）。

### 4. 運用ルールは `development-workflow.md` に記載

「いつ使う／使わない」の使用基準は `docs/guides/development-workflow.md` に 1 セクション追加する。CLAUDE.md は起動時ガイダンスとして要点のみ残す方針（principles/README.md が SSoT）に従い変更しない。

### 5. devcontainer.md の Playwright 記述との関係

`docs/guides/devcontainer.md` 既存の「Playwright の利用」セクションは **E2E 用 `playwright` 導入を後続 Issue で扱う前提** で書かれている。本 ADR の MCP（`@playwright/mcp`）と E2E 用 `playwright` を読者が混同しないよう、同セクションに 1 段落の補足を追加し両者を区別する。

## Consequences

### ポジティブ

- Claude が UI 実装の動作検証を自分で行えるようになり、完了報告の信頼性が向上する
- US-3 のストリーム挙動など、人間の手動確認では再現性の低い検証を補える
- `.mcp.json` 単独の変更のため、ADR-0010 / ADR-0016 への影響なし
- spec / CI を持たないため、メンテコストが Plugin / E2E 方式と比較して最小

### ネガティブ / リスク

- DevContainer のリビルド時に Chromium 取得分の時間とディスク容量が増加する（数百 MB オーダー）
- `.claude/settings.json` の MCP allow 追加により Claude の利用可能ツール表面が広がる。運用ルールで「いつ使う／使わない」を明示しないと、些末な変更でもブラウザを開く過剰検証に陥る恐れがある
- Plugin 方式や E2E フレームワーク採否は本 ADR の射程外として未決のまま残る。判断時期は (a) 公式 Plugin に skill / agent が同梱されるなど機能差が顕在化した時点、(b) リグレッション検知が必要なほど画面・機能が増えた時点、を目安とする
- `playwright` を `package.json` に E2E 用途で追加する将来時点で、Chromium バイナリが MCP と重複する可能性がある。`PLAYWRIGHT_BROWSERS_PATH` の共有や version pin の方針は E2E 導入 ADR の検討事項として明示的に未決のまま残す
- `@playwright/mcp@latest` の version pin は当面行わない。固定する判断時期の目安は (a) E2E 導入 ADR の検討時に E2E 側 `playwright` の version と揃えるタイミング、(b) MCP 側のバージョン変更で動作の揺れ（API 変更・ブラウザ起動失敗等）が発生した時点、のいずれか早い方。なお `.mcp.json` の MCP サーバは `package.json` の依存ではないため [ADR-0022](./0022-dependabot-operational-policy.md) の Dependabot 監視対象外であり、更新は手動である点も pin 判断時の考慮要素となる
