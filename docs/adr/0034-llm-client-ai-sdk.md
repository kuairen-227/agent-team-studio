# 0034. LLM クライアントへの Vercel AI SDK Core 採用（恒久マルチベンダー方式の確定）

## Status

accepted

- 作成日: 2026-06-06
- 関連: ADR-0020（SDK 選定・本 ADR が Decision §1・§3 を一部 supersede / 方針4 を充足）, ADR-0029（無料ルート・到達手段を更新）, ADR-0032（恒久方式の確定先＝本 ADR）, Issue #252（恒久対応方式の確定判断）

## Context

[ADR-0032](./0032-llm-multi-vendor-strategy.md) は短期方針として方向1（LiteLLM ゲートウェイ・アプリ無変更）を accepted とし、**中長期の恒久方式は実測待ちで保留**していた（Issue #252 が確定をトラッキング）。

恒久方式の確定にあたり、当初 ADR-0032 が想定した「数週間の運用実績（429 発生率・ゲートウェイ運用負荷・品質安定性）を観測してから判断する」というデータ駆動の確定トリガは、実態に照らして成立しなかった:

- 実機検証（`docs/validation/dogfooding-log.md` §7-11）は 2026-06-02 に各候補 1 回ずつのクリーン実行のみ。
- 本プロジェクトは 1 人運用の学習プロジェクト（ADR-0002）であり、無料ルート（ゲートウェイ経由）を数週間"自動的に"回し続ける運用シナリオが自然には発生しない。観測窓を待っても確定に足るデータは蓄積されない公算が高い。

したがって恒久方式は**運用データ待ちではなく、複数ベンダー LLM 利用の現時点（2026-06）のベストプラクティスに基づく質的判断**で確定する。この判断は ADR-0020 方針4 が予約した「2 つ目 provider 現実化時の Interface 抽出 vs Vercel AI SDK の再比較」の正規発火に当たる。

### 現時点（2026-06）のベストプラクティス調査

複数ベンダー LLM を TypeScript サーバーアプリで扱う定石は **SDK 抽象とゲートウェイの 2 層**であり、両者は排他ではなく補完関係:

- **アプリ内抽象 = Vercel AI SDK（AI SDK Core）** が TS ネイティブの事実上の標準。`streamText` + provider パッケージ（`@ai-sdk/anthropic` / `@ai-sdk/groq` / `@ai-sdk/google` 等）で、ベンダー差・streaming・AbortSignal・fallback を統一インターフェースで吸収する。
- **ゲートウェイ層 = LiteLLM / Vercel AI Gateway**（任意）。ルーティング・コスト追跡・コンプライアンスログが必要になった段階で proxy として被せる。常駐運用の責務が伴うため、必要が顕在化するまで導入しない。

出典: [AI SDK by Vercel](https://ai-sdk.dev/docs/introduction) / [LLM Gateway Architecture: 2026 Engineering Reference](https://www.digitalapplied.com/blog/llm-gateway-architecture-2026-engineering-reference) / [How to Configure Multiple AI Providers with the Vercel AI SDK](https://ai-sdk.guide/providers/)

### ADR-0020 却下理由C の射程訂正（誠実さのため明示）

ADR-0020 は Vercel AI SDK を却下（Considered Alternatives 行C / 本 ADR では再評価条件）した。その根拠は **却下理由C =「React + Vite + Hono + 自前 WebSocket スタックでは `useChat` 等の真価を活かせない」** だった。

これは **AI SDK の React クライアントフック（`useChat` / `useCompletion`）に関する評価**であり、本 ADR が採用する **サーバー側 AI SDK Core（`streamText` 等）には当てはまらない**。本アプリが必要とするのは「サーバー側でのベンダー横断 provider 抽象」であって、フロントの WebSocket スタックは不変（フロントは AI SDK の React フックを使わない）。つまり却下理由C は本件の採否に無関係であり、ADR-0020 の Vercel AI SDK 却下はサーバー側 Core 採用には及ばない。

### 技術前提の裏取り（公開境界が不変であること）

ADR-0020 方針2 は「`llm-client.ts` の公開境界を `LlmInput` + `AsyncIterable<string>` でドメイン型化し、Anthropic SDK 型を境界外へ漏らさない」と定めた。AI SDK Core はこの境界を**変えずに**内部実装を差し替えられる:

- `streamText({ model, system, prompt, temperature, abortSignal, ... }).textStream` は **`AsyncIterable<string>`**。既存公開境界（`LlmInput` → `AsyncIterable<string>`）への drop-in。
- `abortSignal` / `timeout` / `maxOutputTokens` / `maxRetries` をサポート。現行の中断・タイムアウト・リトライ方針（ADR-0020 方針4 のリトライ含む）と整合。
- provider はモデル指定（`anthropic/...`, `google/...`）または provider パッケージ（`@ai-sdk/groq` 等）で切替。

検証元: AI SDK Core `streamText` リファレンス（context7 `/vercel/ai`）。

### 決定的事実（ADR-0032 §前提の再掲）

agent 経路（`packages/agent-core/src/agent.ts`）が LLM に渡すのは `LlmInput`（model / system / user / temperature / max_tokens）のみ、受け取るのは `AsyncIterable<string>`（text_delta 結合）のみ。thinking / citations / prompt caching / tool use はリポジトリ全体で未使用。ADR-0020 が `@anthropic-ai/sdk` ネイティブ採用の主根拠とした「Claude 固有機能への最速追従」は agent 経路で一度も行使されていない。この事実が「Anthropic ネイティブ SDK への固執を解除してよい」根拠となる。

## Considered Alternatives

恒久方式の候補は ADR-0032 §Considered Alternatives で評価済み（方向1 ゲートウェイ / 方向2 Vercel AI SDK / 方向2′ 自前 interface）。本 ADR はその確定であり、ここでは確定にあたっての最終比較のみ記す。

| # | 方式 | 採否 | 理由 |
| - | --- | --- | --- |
| 方向1 恒久化 | LiteLLM 等ゲートウェイ常駐 | 却下 | プロキシ常駐の運用責務・障害点 +1 が 1 人運用で重い。無料ルートを継続運用する実態も確認されていない。ゲートウェイは「必要時に被せる任意層」へ降格 |
| 方向2 | Vercel AI SDK Core（サーバー側 provider 抽象） | **採用** | 複数ベンダーの 2026 ベストプラクティス。provider 抽象・streaming・AbortSignal・fallback を保守されたライブラリに委譲。却下理由C はクライアント限定で本件に無関係。公開境界（方針2）は不変。`@ai-sdk/anthropic` はネイティブ `/v1/messages` を使うため将来の Claude 固有機能にも到達可能 |
| 方向2′ | 自前 `LlmProvider` interface | 不採用（次点） | 学習価値は最大だが、ベンダーごとの streaming 正規化・エラー形・abort 吸収の自前保守は「学習で得る価値」より「継続コスト」の比重が大きい。アプリ側の境界設計（`llm-client.ts`）は方向2 でも自分で保持でき、設計の核は失われない |

### Anthropic の OpenAI 互換性についての補足

Anthropic ネイティブ API は `/v1/messages` で OpenAI 形式（`/v1/chat/completions`）とは別物。Anthropic は OpenAI 互換レイヤーも提供するが、公式に「テスト・移行用であり本番向けの長期解ではない」と位置づけ、prompt caching / citations / extended thinking / tool 厳格スキーマ等が非対応（[OpenAI SDK compatibility - Claude API Docs](https://platform.claude.com/docs/en/api/openai-sdk)）。

方向2 では `@ai-sdk/anthropic` が**ネイティブ `/v1/messages` を使う**ため、互換シムの制約・将来の Claude 固有機能利用時の手戻りを回避しつつ、他ベンダーも各 provider パッケージでネイティブ到達できる。1 つの interface のまま全ベンダーをネイティブで扱える点が方向2 の優位。

## Decision

**LLM クライアント（`packages/agent-core/src/llm-client.ts`）の内部実装を `@anthropic-ai/sdk` から Vercel AI SDK Core（`ai` + provider パッケージ）へ移行する。** これを ADR-0032 が保留していた恒久マルチベンダー方式の確定とする。

### 1. 採用

- サーバー側 LLM 呼び出しを `ai` の `streamText`（および必要に応じ `generateText`）で実装する。
- provider パッケージは利用ベンダーに応じて追加する（最小は `@ai-sdk/anthropic`。無料ルートの Groq 採用時は `@ai-sdk/groq`、Gemini 比較時は `@ai-sdk/google`）。
- 公開境界（`LlmInput` → `AsyncIterable<string>`）は**維持**する。`textStream` をそのまま公開境界へ流す。

### 2. ADR-0020 への影響

| ADR-0020 の該当箇所 | 本 ADR による操作 |
| --- | --- |
| Decision §1（SDK 採用 = `@anthropic-ai/sdk`） | **supersede**。AI SDK Core（`ai` + `@ai-sdk/*`）に置換。Anthropic へは `@ai-sdk/anthropic` 経由で到達 |
| Considered Alternatives 行C / Decision §3（Vercel AI SDK 却下・再評価条件） | **supersede**。却下理由C はクライアント限定で本件（サーバー側 Core）に無関係と判断し、採用に転換 |
| Decision §2 方針4（Interface 抽出予約） | **充足**。自前 interface 抽出に代えて AI SDK の provider 抽象を採用することで義務を満たす |
| Decision §2 方針2（公開境界のドメイン型遮断） | **維持**（supersede しない）。公開型は不変 |
| Decision §4（リトライ = SDK 内蔵 `maxRetries`） | **維持**。AI SDK Core の `maxRetries` を使用 |

ADR-0020 の Status を `accepted（一部 superseded by 0034）` に更新する（ADR-0016 と同形式）。

### 3. ゲートウェイの位置づけ

LiteLLM 等のゲートウェイは恒久構成から外し、ルーティング・コスト追跡・コンプライアンスログが必要になった段階で被せる**任意のインフラ層**とする。現状の無料ルート（Groq）はゲートウェイ無しで `@ai-sdk/groq` からネイティブ到達する。

### 4. スコープ外（後続作業）

本 ADR は方式の確定のみを扱う。コード移行（`llm-client.ts` 内部置換・依存追加・テスト）・`free-llm-setup.md` の AI SDK ベースへの更新は実装 Issue（enhancement, type-first / テストファースト）に委ねる。

## Consequences

### ポジティブ

- **恒久方式の確定** — ADR-0032 が保留した中長期方式が確定し、Issue #252 が閉じられる。下流タスク（エラートラッキング等）のコスト前提が固まる。
- **マルチベンダーが標準手段で実現** — provider パッケージ追加だけでベンダーを増やせる。streaming 差・エラー形・abort 吸収の自前保守が不要。
- **ゲートウェイ常駐の運用負荷を回避** — 1 人運用の障害点 +1 を恒久構成から外せる。
- **Anthropic ネイティブを保持** — `@ai-sdk/anthropic` 経由で `/v1/messages` を使うため、将来 thinking / prompt caching 等を使う方針に転じても互換シムの制約に縛られない。
- **公開境界が不変** — `llm-client.ts` の公開型を変えずに内部 SDK を差し替えられ、変更範囲が局所化される。

### ネガティブ / リスク

- **新規依存の追加** — `ai` + provider パッケージへの依存が増える。`@anthropic-ai/sdk` 単体より依存表面が広がる。→ 対策: provider パッケージは実利用ベンダー分のみ追加。
- **低レベル挙動の委譲** — streaming イベント・リトライ・タイムアウトの細部が AI SDK の実装に依存する。Claude API の SSE を直接学ぶ機会は減る（ADR-0002 の学習価値の一部後退）。→ 評価: 学習の力点は agent 設計・評価・observability へ振り、低レベル差異の保守はライブラリに委ねる判断。
- **移行時の挙動差** — `@anthropic-ai/sdk` 直叩きと AI SDK Core 経由で、エラー型・タイムアウト・ストリーム終端の挙動に差が出る可能性。→ 対策: 実装 Issue でテストファースト（既存 `llm-client` テストの GREEN 維持 + 移行後の疎通確認）。
- **無料枠そのものの制約は方式で解消しない** — Groq free tier の TPM 6,000 等は宛先依存で残る（ADR-0032 / ADR-0029 §留意のまま）。

### 中立

- **ゲートウェイ知見は runbook に残る** — `dogfooding-log.md` §7-7 の LiteLLM runbook は、将来ゲートウェイを任意層として導入する際の参照として有効。
- **ADR-0029 の無料ルート（Groq）は不変** — サービス選定は変えず、到達手段がゲートウェイ経由から `@ai-sdk/groq` ネイティブへ変わるのみ（ADR-0029 に追記）。
- **Claude 固有機能を将来使うかは本 ADR では判断しない** — 現状未使用の前提で方式を選んだ。使う方針に転じる場合も `@ai-sdk/anthropic` のネイティブ経路で対応可能。
