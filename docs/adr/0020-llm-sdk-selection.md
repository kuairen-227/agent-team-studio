# 0020. LLM SDK の選定

## Status

accepted

- 作成日: 2026-05-02
- 関連: ADR-0008（前提・補足）, Issue #85, Issue #76

## Context

ADR-0008（技術スタック）で LLM API 連携の SDK 選定は「本 ADR のスコープ外。別途決定する」と明記され、未決定のまま残っていた。

`docs/design/llm-integration.md` は既にモデル選定（Claude Sonnet 4.6）・ストリーミング方式・リトライ方針（SDK 内蔵に委任）・プロバイダ依存の局所化方針まで記述済みで、いずれも Anthropic SDK の機能と挙動を前提としている。一方、Issue #76（ランタイム依存導入）で `@anthropic-ai/sdk` の追加が予定されていたが、ADR の裏付けがないため Issue #85 として分離されていた。

実装着手（Issue #81 Spike および Walking Skeleton）の前に SDK を確定し、後続実装の前提を固定する必要がある。

加えて、本プロジェクトは学習目的（ADR-0002）であり、将来的に OpenAI 等のモデルへの切り替え・並行運用を排除しない。SDK 採用と同時に切替容易性の方針も確定しておく。

## Considered Alternatives

### SDK 候補

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `@anthropic-ai/sdk`（Anthropic 公式） | **採用** — 公式 SDK で Claude 固有機能（streaming, AbortSignal による中断, prompt caching, thinking, citations 等）への最速対応。`messages.stream()` のイベント API・`.abort()`・`maxRetries` が `llm-integration.md` の設計前提と直接整合。Anthropic が Bun の親会社（2025-12 買収）でファーストパーティ扱い |
| B | `openai`（OpenAI 公式 SDK を Anthropic OpenAI 互換 endpoint 経由で利用） | 却下 — Claude 固有機能（thinking / citations / prompt caching）が利用できず、`llm-integration.md` の設計前提を満たせない。OpenAI SDK 経由で Claude を呼ぶ二重抽象に学習価値もない |
| C | `ai` + `@ai-sdk/anthropic`（Vercel AI SDK） | 却下 — provider 抽象化と React フック群が主価値だが、本 MVP のスタック（React + Vite + Hono + 自前 WebSocket）では `useChat` 等の真価を活かしにくい。Claude 固有機能の追従ラグもある。マルチ provider 化が現実化した時点で再評価する（後述 §再評価条件） |
| D | `@anthropic-ai/claude-agent-sdk`（Anthropic 高レベル Agent SDK） | 却下 — agent loop / tool execution / context management を SDK に委譲する高レベル抽象。本 MVP は `packages/agent-core` で agent engine を自前実装する方針（ADR-0009）であり、SDK の前提が衝突する |
| E | LangChain.js（`@langchain/anthropic`） | 却下 — フレームワーク層が厚く MVP に対して重い。設計 doc 群も LangChain 前提で書かれていない |
| F | OpenRouter / token.js 等のゲートウェイ系 | 却下 — マルチ provider ルーティングが主価値。MVP は単一 provider 前提であり過剰 |

### 切替容易性の粒度

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 局所化のみ（`agent-core/llm-client.ts` に SDK import を閉じ込めるだけ） | 却下 — Anthropic SDK の型（`MessageStreamEvent` 等）が `agent-core` 内の他ファイルに漏れた場合、差し替え時に追跡コストが発生する |
| B | 境界の明確化（局所化 ＋ 公開 API のドメイン型遮断） | **採用** — 切替点を `llm-client.ts` の公開シグネチャ 1 箇所に集約し、Anthropic SDK の型を境界の外へ漏らさない。Interface 抽出は実装 1 件のうちは不要。YAGNI と将来対応のスイートスポット |
| C | Provider 抽象化（`LlmProvider` interface ＋ `AnthropicProvider implements LlmProvider`） | 却下 — 2 つ目の provider が現れない段階で interface を切ると、将来の OpenAI / Vercel AI SDK の API 形状と合わずに作り直す可能性が高い。Rule of Three に従い 2 件目の実装が出た時点で抽出する |

## Decision

### 1. SDK の採用

`@anthropic-ai/sdk` を採用する。導入先は `packages/agent-core` のみ。

### 2. 切替容易性の方針（境界の明確化）

`packages/agent-core/src/llm-client.ts` を Anthropic SDK との唯一の接点とし、以下のルールを守る:

1. **境界の集約** — Anthropic SDK の `import` は `llm-client.ts` のみで行う。`apps/api` や `agent-core` 内の他ファイルからは直接 import しない
2. **公開シグネチャのドメイン型化** — `llm-client.ts` の公開関数（例: `streamAgentMessage(input): AsyncIterable<TextDelta>`）は引数・戻り値・例外を `agent-core` のドメイン型で定義する。Anthropic SDK の型（`MessageStreamEvent`, `APIError` 等）を戻り値・例外として外へ漏らさない
3. **内部実装の自由** — `llm-client.ts` の内部では Anthropic SDK の型を自由に使ってよい。境界の外側でのみ遮断する
4. **Interface 抽出は保留** — `LlmProvider` interface 等の抽象化は、2 つ目の provider 採用が現実化した時点で抽出する（Rule of Three）。その時点で本 ADR の方針 2 を一部 superseded する ADR を切る

### 3. Vercel AI SDK の再評価条件

以下のいずれかが現実化した時点で、自前 interface 抽出 vs Vercel AI SDK 採用を改めて比較する:

- 半年〜1 年以内に OpenAI / Google 等への切り替えまたは並行運用を行う方針が決まる
- フロント側で `useChat` / `useCompletion` 等の AI SDK React フックを使う設計が出る
- 単一 provider 前提を崩す要件（AI Gateway 経由ルーティング等）が出る

### 4. リトライの実装方針

`@anthropic-ai/sdk` 内蔵の `maxRetries` を使用する（`llm-integration.md §リトライの実装方針` に準拠）。独自リトライロジックは実装しない。

## Consequences

- `@anthropic-ai/sdk` への単一プロバイダロックインが発生する。差し替え時は `llm-client.ts` の中身を書き換える必要がある（ただし方針 2 により変更範囲は `llm-client.ts` 内に閉じる）
- Claude 固有機能（thinking / prompt caching / citations / tool use 等）に最速で追従できる
- `llm-client.ts` の公開 API を設計する責任が発生する（戻り値型・例外型の定義）。実装着手時に Spike（Issue #81）の知見をもとに設計する
- 2 つ目の provider が現実化した時点で、Interface 抽出 ADR を切る必要がある（本 ADR 方針 4 で明示）
- Issue #76 で保留されていた `@anthropic-ai/sdk` 導入の前提が確定する
- ADR-0008 の「SDK 選定は別途決定」が本 ADR で確定する（ADR-0008 本文の文言は残置し、相互参照は本 ADR 関連節に記載）
