# spike/

Issue [#81](https://github.com/kuairen-227/agent-team-studio/issues/81) の Spike コード置き場。Walking Skeleton (Issue [#82](https://github.com/kuairen-227/agent-team-studio/issues/82)) 着手時に削除予定。

検証結果のサマリは [docs/design/technotes/ws-llm-spike.md](../docs/design/technotes/ws-llm-spike.md) を参照。

## 位置付け

- 本体ワークスペース (`apps/*` / `packages/*`) には含めない独立ディレクトリ
- 依存関係は `spike/package.json` に閉じ、`spike/node_modules` で完結する
- 製品コードに昇格させない (Walking Skeleton 実装時に正式実装を `apps/api` / `packages/agent-core` に書き起こし、本ディレクトリは削除)

## セットアップ

```bash
cd spike && bun install
```

LLM spike は Anthropic API を実呼び出しするため `ANTHROPIC_API_KEY` が必要 (リポジトリルートの `.env.example` 参照)。

## 実行

### WebSocket spike

別ターミナルで:

```bash
cd spike && bun run ws:server   # ターミナル A: サーバ起動 (port 3100)
cd spike && bun run ws:client   # ターミナル B: 3 ケース連続実行
```

検証ケース:

| Case | 内容 | 期待結果 |
| --- | --- | --- |
| A | 不正な `executionId` で接続 | サーバ側で close `4404 execution_not_found` |
| B | 正常 `executionId` で接続 | 初期スナップショット (5 件) → push (5 件) → `execution:completed` → close `1000` |
| C | クライアント主導 close | サーバ側 `onClose` 発火 |

### LLM spike

```bash
cd spike && ANTHROPIC_API_KEY=... bun run llm
```

検証ケース:

| Case | 内容 | 期待結果 |
| --- | --- | --- |
| 1 | 外部 `AbortController.abort()` (500ms) | `APIUserAbortError` で即時中断 |
| 2 | `stream.abort()` を 5 chunk 受信後に呼ぶ | `APIUserAbortError` で即時中断 |
| 3 | `AbortSignal.timeout(1000)` 単体 | `APIUserAbortError` で 1s 経過後中断 |
| 4 | `AbortSignal.any([execution, agent, llm])` 3 階層合成 | 最短の `agent` (800ms) で当選 |
| 5 | 正常完了 (制御群) | エラーなし、chunk 受信 |

実コスト概算: Haiku で 5 ケース合計 < $0.001。
