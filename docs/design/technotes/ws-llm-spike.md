# Spike 検証結果: WebSocket + LLM streaming + AbortSignal

Issue [#81](https://github.com/kuairen-227/agent-team-studio/issues/81) の Spike 検証結果。Walking Skeleton (Issue #82) 着手前に、設計前提が実機で成立するかを確認した。

検証コードは [`spike/`](../../../spike/) を参照（Walking Skeleton (#82) 着手時に削除予定のため、本リンクは一時参照）。削除時は本 technote のリンクも削除し「検証コードは Issue #81 / PR #113 の履歴を参照」に書き換える。

## 検証環境

| 項目 | バージョン |
| --- | --- |
| Bun | 1.3.13 |
| Hono | 4.12.16 |
| `@anthropic-ai/sdk` | 0.92.0 |
| 検証日 | 2026-05-03 |

## 検証 1: Hono + Bun の WebSocket

### 検証 1 範囲

`hono/bun` の `upgradeWebSocket` を用いた最小サーバを起動し、3 ケースをクライアントから実行。

### 検証 1 結果

| Case | 内容 | 期待 | 実測 | 判定 |
| --- | --- | --- | --- | --- |
| A | 不正な `executionId` (空文字) で接続 | close `4404 execution_not_found` | close `4404 execution_not_found`、サーバ受信メッセージ 0 | ✅ |
| B | 正常 `executionId` で接続 | 初期スナップショット 5 件 → push 5 件 → `execution:completed` → close `1000` | 11 メッセージ受信 (`agent:status×5`、`agent:output×5`、`execution:completed×1`)、close `1000` | ✅ |
| C | クライアント主導 `ws.close(1000)` を 3 メッセージ受信後 | サーバ側 `onClose` が発火 | サーバログに `[server] close code=1000` 出力、`onClose` 内 `clearInterval` まで到達 | ✅ |

### 検証 1 と設計前提との整合

- `upgradeWebSocket((c) => { onOpen, onMessage, onClose })` の API で [websocket-design.md §接続ライフサイクル](../websocket-design.md) の主要動作 (ハンドシェイク・初期スナップショット・サーバ push・クライアント切断検知) はすべて実装可能
- close code 4xxx (アプリケーション定義) も `ws.close(4404, "execution_not_found")` で問題なく送出可能
- サーバから複数 `ws.send()` を高頻度発行しても順序逆転なし (TCP 順序がそのまま保たれる、[websocket-design.md §メッセージ順序保証](../websocket-design.md) と整合)

### 注意点 (実装時に踏まえる)

- **不正 `executionId` の close タイミング** — `upgradeWebSocket` のコールバックは「アップグレードを受理した後」に `onOpen` が呼ばれる構造。HTTP レイヤで 404 を返すのではなく、WebSocket ハンドシェイク (HTTP 101) 成立直後に close フレーム (4404) を送る挙動になる。クライアントから見ると `WebSocket` の `onclose` が `code=4404` で発火し、`onopen` は発火しない場合と発火直後に close される場合がある (環境依存)。`websocket-design.md` の `close(4404, "execution_not_found")` 表記と機能的には一致するが、HTTP レイヤで弾く実装ではない点を実装メモに残す
- **`onClose` 内のリソース解放** — push 用の `setInterval` を `onClose` で `clearInterval` する責務はサーバ側に残る。これを怠るとクライアント切断後もタイマが回り続けるリスクあり。Walking Skeleton 実装時は `AbortController` ベースに統一するのが望ましい

## 検証 2: Anthropic SDK streaming + AbortSignal

### 検証 2 範囲

`client.messages.stream(body, { signal })` に `AbortSignal` を渡し、5 ケースを実行。

### 検証 2 結果

| Case | 内容 | 経過 ms | chunk 数 | 例外型 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | 外部 `AbortController.abort()` を 500ms 後に呼ぶ | 530 | 0 | `APIUserAbortError` | ✅ 即時中断 (~30ms) |
| 2 | `MessageStream.abort()` を 5 chunk 受信後に呼ぶ | 1554 | 5 | `APIUserAbortError` | ✅ SDK 経由でも同一例外型 |
| 3 | `AbortSignal.timeout(1000)` 単体 | 1036 | 2 | `APIUserAbortError` | ✅ Web 標準 timeout signal も即時動作 |
| 4 | `AbortSignal.any([execution=10s, agent=800ms, llm=120s])` 3 階層合成 | 828 | 0 | `APIUserAbortError` | ✅ 最短 (agent) で当選、~28ms オーバー |
| 5 | 正常完了 (制御群、`max_tokens=64`) | 760 | 2 | — | ✅ エラーなし、stream 完走 |

### 検証 2 と設計前提との整合

- [agent-execution.md §7 タイムアウト階層](../agent-execution.md) の 3 階層 (LLM 単体 / エージェント単位 / Execution 全体) は **`AbortSignal.any([s1, s2, s3])` で素直に合成可能**。SDK 側に拡張は不要
- [agent-execution.md §8 キャンセル](../agent-execution.md) の「`AbortSignal` で進行中の LLM 呼び出し (SDK リトライ含む) を中断」は SDK 内蔵の AbortSignal 連動で実現される。独自リトライロジック不要 ([llm-integration.md §リトライの実装方針](../llm-integration.md) の前提を補強)
- 中断時の例外型は **常に `APIUserAbortError`** で一貫する (外部 `AbortController` 経由・`MessageStream.abort()` 経由・`AbortSignal.timeout()` 経由のいずれも同じ)。`agent-core` 側の例外ハンドラはこの 1 種類を `AgentFailReason: "timeout"` または `"internal_error"` に写像すればよい

### 例外マッピング指針 (実装メモ)

`llm-client.ts` の境界で `APIUserAbortError` を以下の 2 つの内部 reason に写像する:

| 起点 | 写像先 `AgentFailReason` |
| --- | --- |
| `AbortSignal.timeout()` または engine が timeout 起点で発行した signal | `"timeout"` |
| ユーザー / engine からの明示的キャンセル (MVP では未使用) | (該当なし — MVP スコープ外、[agent-execution.md §8](../agent-execution.md)) |

`APIUserAbortError` 自体には起点情報が含まれないため、**起点判定は engine 側で「どの signal が abort されたか」を保持**する必要がある (`AbortSignal.any` で合成した個別 signal の `aborted` プロパティを参照)。

## 既存 design doc への反映

検証の結果、既存 design doc の **設計前提はすべて実機で成立**。本体記述の修正は行わない。

[ADR-0021 ドキュメント間参照ポリシー](../../adr/0021-doc-cross-reference-policy.md) に従い、設計 doc から本 technote への逆参照は付けない（双方向リンクの回避）。本 technote は設計 doc を参照する片方向で接続する。技術ノートとしての発見導線は [docs/design/README.md](../README.md) の `technotes/` 索引に集約する。

## 結論

- WebSocket / LLM streaming / AbortSignal の 3 点とも、`agent-execution.md` / `websocket-design.md` / `llm-integration.md` の設計前提は実機で成立
- Walking Skeleton (Issue [#82](https://github.com/kuairen-227/agent-team-studio/issues/82)) は本検証コードを参考に、`apps/api`・`packages/agent-core` への正式実装を進める
- 設計 doc の本体記述変更は不要
