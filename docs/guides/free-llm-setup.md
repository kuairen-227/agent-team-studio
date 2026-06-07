# LLM API 設定ガイド

> **対象読者**: 本ガイドはアプリの LLM プロバイダを切り替える**開発者・エンジニア向け**。Docker コマンド・SQL での DB 更新・`apps/api/.env` の直接編集を含む。

LLM プロバイダは **provider ごとの API キー env** と **DB テンプレの model 文字列（`provider:model` 形式）** で切り替える。アプリは [Vercel AI SDK Core](https://ai-sdk.dev/docs/introduction) 経由で各 provider にネイティブ到達する（[ADR-0034](../adr/0034-llm-client-ai-sdk.md)）。

- **最高品質（推奨デフォルト）**: Anthropic 本家（有料・従量課金）。model `anthropic:claude-sonnet-4-6`
- **無料運用（推奨）**: Groq Llama 3.3 70B を `@ai-sdk/groq` で**ネイティブ利用**（ゲートウェイ不要）。model `groq:llama-3.3-70b-versatile`

参照: [ADR-0034（AI SDK Core 採用）](../adr/0034-llm-client-ai-sdk.md) / [ADR-0029（無料 LLM API の選定）](../adr/0029-free-llm-api-selection.md) / [ADR-0032（マルチベンダー対応方式の短期方針）](../adr/0032-llm-multi-vendor-strategy.md)

> **背景（重要）**: 当初の無料ルート（OpenRouter `:free` / Ollama ローカル）は実機検証で前提が崩れた（`:free` は実質クレジット入金必須 #212 / Ollama は CPU 推論で速度不足 #229・#246）。代替候補（Gemini / Groq 等）は **いずれも Anthropic 非互換（OpenAI 互換のみ）** だが、AI SDK の provider パッケージ（`@ai-sdk/groq` 等）が各ベンダーへネイティブ到達するため、**変換ゲートウェイ無しで利用できる**。実測の結果 **Groq が無料枠で最も実用的**、Gemini 無料枠は **現アプリの parser 実装のままでは** JSON 構造化出力が不安定で非推奨（後述）。
>
> **ゲートウェイの位置づけ（ADR-0034）**: LiteLLM 等のゲートウェイは恒久構成から外れ、ルーティング・コスト追跡が必要になった段階で被せる**任意のインフラ層**となった。Groq はゲートウェイ無しで `@ai-sdk/groq` からネイティブ到達する。ゲートウェイ経由の手順は将来参照用に [dogfooding §7-7 runbook](../validation/dogfooding-log.md) に残す。

## 選択フロー

```text
LLM API の選択
  ├─ 最高品質を優先（推奨デフォルト）
  │  └─ Anthropic 本家（Option A）— model: anthropic:claude-sonnet-4-6
  │     - Claude Sonnet 4.6 / 従量課金 / JSON 安定
  │
  ├─ 無料で利用したい（推奨）
  │  └─ Groq Llama 3.3 70B（Option B）— model: groq:llama-3.3-70b-versatile
  │     - @ai-sdk/groq でネイティブ到達（ゲートウェイ不要）
  │     - 実測 4/4 完走・JSON 安定・マトリクス充実（単発クリーン実行時）
  │     - 超高速・学習利用なし
  │     - 留意: free tier は TPM 6,000（連続/大入力で 429 リスク）
  │
  └─ 条件付きの代替（Groq の TPM 6,000 が連続/大入力で足りない、または GPU 環境がある等の場合）
     ├─ OpenRouter BYOK（Option C）— :free は入金実質必須。自前キーでレート枠を拡張したいとき
     └─ Ollama（Option D）— GPU 推論環境が事実上の前提（CPU は実用不可）。完全ローカル/オフラインにしたいとき
```

> **Option C / D について**: 現在の provider レジストリ（`packages/agent-core/src/llm-client.ts`）に登録済みなのは `anthropic` / `groq` の 2 つ。OpenRouter / Ollama を使うには対応する AI SDK provider パッケージ（例 `@openrouter/ai-sdk-provider` / `ollama-ai-provider`）を追加しレジストリに 1 行登録する必要がある（本ガイドでは到達手段の参考として記載）。

## Option A: Anthropic 本家（推奨デフォルト）

### セットアップ

1. **API キー取得**: [console.anthropic.com](https://console.anthropic.com) → API Keys（`sk-ant-...`）
2. **環境変数**:

   ```bash
   # apps/api/.env
   ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
   # ANTHROPIC_BASE_URL は未設定（デフォルトで api.anthropic.com）
   ```

3. **DB テンプレの model**（デフォルトの seed 値）: `anthropic:claude-sonnet-4-6`
4. **動作確認**: `bun run test`

### 特徴

- 最高品質（Claude Sonnet 4.6）、JSON 構造化出力が安定、競合調査用途での品質基準
- `@ai-sdk/anthropic` はネイティブ `/v1/messages` を使うため、将来 thinking / prompt caching 等を使う方針に転じても互換シムの制約に縛られない

---

## Option B: Groq（無料・推奨）

### なぜゲートウェイが不要になったか

Groq は **OpenAI 互換 API のみ**を提供し Anthropic `/v1/messages` を話さない。旧構成（[ADR-0020](../adr/0020-llm-sdk-selection.md) の Anthropic SDK ネイティブ）では変換ゲートウェイ（LiteLLM）が必要だったが、[ADR-0034](../adr/0034-llm-client-ai-sdk.md) で AI SDK Core へ移行したため、`@ai-sdk/groq` が Groq の OpenAI 互換 API に**ネイティブ到達**する。**ゲートウェイは不要**。

```text
[app] --AI SDK Core (@ai-sdk/groq)--> Groq
```

### セットアップ手順

1. **Groq API キー取得**: [console.groq.com](https://console.groq.com) → API Keys（`gsk_...`）。カード/入金不要。

2. **アプリ env を設定**（`apps/api/.env`）:

   ```bash
   GROQ_API_KEY=gsk_...
   # GROQ_BASE_URL は未設定（デフォルトで api.groq.com）
   ```

3. **DB テンプレの model を切替**（model は `templates.definition.llm.model` に焼かれている。`seed.ts` は既存を上書きしないため SQL で更新）:

   ```bash
   psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"groq:llama-3.3-70b-versatile\"') WHERE name = '競合調査';"
   ```

4. **動作確認**: `bun run dev` を再起動し、競合調査テンプレを 1 実行 → Investigation×4 / Integration×1 の完走を確認。

### 特徴・実測（dogfooding §7-11）

- 競合調査テンプレで **4/4 完走・JSON 安定・4 観点×3 社マトリクス充実**（**単発クリーン実行時**の実測。連続実行・大入力では TPM 6,000 により結果が変わりうる）。無料枠としては Option A Anthropic 本家に最も近い品質。
- 超高速（数百 tok/s）、学習利用なしと明記。

> 上記の実測値は LiteLLM ゲートウェイ経由で取得したものだが、到達経路が `@ai-sdk/groq` ネイティブに変わっても宛先モデル（Groq Llama 3.3 70B）は同一のため、品質・レート特性はそのまま当てはまる。

### 留意点

- **free tier は TPM 6,000**（30 RPM / 1,000 RPD）。今回の単発実行では 429 は出なかったが、入力規模の増大・連続実行では `429 rate_limit` のリスクが残る。頻発する場合は Groq Dev tier、または OpenRouter BYOK（Option C）でレート枠を拡張する。
- Max Output 32,768 / Context 128K で本アプリ要件（Max Output ≥ 8K / Context ≥ ~13K）は満たす。

---

## Option C: OpenRouter（条件付き・BYOK 推奨）

OpenRouter は OpenAI 互換 endpoint を提供する。AI SDK から使うには OpenRouter 用の provider パッケージ（例 [`@openrouter/ai-sdk-provider`](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)）を追加し、`llm-client.ts` のレジストリに `openrouter` を登録したうえで model を `openrouter:<model>` 形式で指定する。

### 初期設定

1. **API キー取得**: [openrouter.ai](https://openrouter.ai) → API Keys（`sk-or-...`）
2. **環境変数**（provider パッケージが参照する標準 env を設定）:

   ```bash
   OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
   ```

### 重要: `:free` モデルでもクレジット入金が実質必要（#212）

OpenRouter は `max_tokens` に基づく **pre-flight reservation（事前与信）** を行う。`:free` モデルでも `max_tokens` 分のコストを残高から予約しようとし、残高不足だと 402 を返す。

```text
LLM API error: 402
"This request requires more credits, or fewer max_tokens.
 You requested up to 1500 tokens, but can only afford 756."
```

本アプリの Investigation (`max_tokens=1500`) / Integration (`max_tokens=8000`) を継続実行するには **クレジット入金（$10〜）が事実上必須**。

### 推奨用途

- **BYOK 設定**（[Integrations](https://openrouter.ai/settings/integrations) で Groq / Together 等の自前キーを登録）すると、自分のキー基準のレート制限になり実用的。
- レート制限: 20 req/min・50 req/day（未入金時）/ 1,000 req/day（$10 入金後）。1 実行 ~5 req のため未入金だと 1 日 ~10 実行が上限。

---

## Option D: Ollama（条件付き・ローカル無料）

> **本アプリでの実用判定（重要）**: Issue #229 のドッグフーディングで、**消費者向け CPU 推論（40 GB RAM / Intel Iris Xe）では本アプリの統合 Agent（`max_tokens=8000`）は事実上動かない**ことが判明した（[dogfooding §6](../validation/dogfooding-log.md#6-ollama-検証-issue-229)）。**Ollama は GPU 推論環境（NVIDIA CUDA / Apple Metal）が事実上の前提条件**。GPU を持たない場合は Option A / B を選ぶ。

AI SDK から使うには Ollama 用 provider パッケージ（例 [`ollama-ai-provider`](https://www.npmjs.com/package/ollama-ai-provider)）を追加し、レジストリに `ollama` を登録したうえで model を `ollama:<model>` 形式で指定する。

### インストール・起動

```bash
# macOS
brew install ollama
# Linux
curl -fsSL https://ollama.ai/install.sh | sh

ollama serve
ollama pull llama3.3:70b   # GPU 環境向け、40GB メモリ必要
```

Windows: [ollama.com/download/windows](https://ollama.com/download/windows) から取得。インストール後はタスクトレイ常駐、`http://localhost:11434` で API 起動。

### DB テンプレの model

```bash
psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"ollama:llama3.3:70b\"') WHERE name = '競合調査';"
```

### Windows + DevContainer での追加設定

DevContainer（Linux コンテナ）から Windows ホストの Ollama に到達するには `0.0.0.0` で listen させ、コンテキスト枠を拡張する（統合 Agent は ~12.4K トークン必要、デフォルト 4096 では出力切れ）:

```powershell
setx OLLAMA_HOST "0.0.0.0:11434"
setx OLLAMA_CONTEXT_LENGTH "16384"
```

`setx` は新規プロセスにのみ反映されるため、設定後は Ollama を完全終了→再起動する。Ollama provider パッケージの baseURL は DevContainer 内から `http://host.docker.internal:11434` を指定。

### 実測ベース: CPU 推論は本アプリで使えない

Issue #229（Windows / Intel Iris Xe / 40 GB RAM / CPU 推論 / `llama3.1:8b`）の計測:

```text
HTTP 200  elapsed=113.41s  output_tokens=270  → 2.38 tok/s
```

| Agent | `max_tokens` | 必要時間（2.38 tok/s） | 120 秒 timeout 内 |
| --- | --- | --- | --- |
| Investigation × 4 並列 | 1500 | 約 630 秒 / agent | ✕ |
| Integration | 8000 | 約 3360 秒（56 分） | ✕ |

加えて Llama 3.1 8B は Dify / n8n / Zapier 等のドメイン知識が不足し、架空機能を生成するため品質も実用水準未満。GPU 推論（70B 級）であれば実用可。

---

## Gemini 無料枠について（非推奨）

実機検証（dogfooding §7-11）で、Gemini 2.5 Flash はスペック上は最強（1M context / Max Output 65,536）だが、**本アプリでは Investigation の過半が `output_parse_error` で脱落**し、実質的な分析結果を得られなかった（2 回とも再現）。加えて **無料枠はプロンプトが学習に利用される**。したがって本アプリの無料運用ルートとしては非推奨。

- 原因の一端はアプリ側 parser の厳格さ（` ```json ` フェンス除去のみ）にもあり、寛容化すれば一部回復の余地はある。ただし現状のアプリのままでは信頼できない。
- 利用する場合は `@ai-sdk/google` をレジストリに登録し model を `google:gemini-2.5-flash` 形式で指定する（ゲートウェイ不要）。

---

## 設定値の確認・トラブルシューティング

```bash
cat apps/api/.env   # 現在の設定を確認
```

### 共通

- **`No LLM provider API key is set`（起動失敗）**: `apps/api/.env` に `ANTHROPIC_API_KEY` / `GROQ_API_KEY` のいずれも設定されていない。最低 1 つを設定する。
- **`Unknown LLM provider in model "..."`**: DB テンプレの model が `provider:model` 形式でない、または未登録 provider。`anthropic:` / `groq:` 接頭辞を確認する。

### Groq

- **`429 rate_limit`（Groq）**: free tier TPM 6,000 超過。Dev tier / BYOK へ切替、またはリクエスト間隔を空ける。
- **`model not found`**: DB テンプレの model 名（接頭辞除く部分）が Groq のモデル ID と一致しているか確認（例 `llama-3.3-70b-versatile`）。

### OpenRouter

- **401**: API キー（`sk-or-...`）を確認。
- **429**: リセット（UTC 00:00）まで待つか間隔を広げる。**402**: クレジット残高不足（pre-flight reservation）。

### Ollama

- **Connection refused**: `ollama serve` 起動を確認。**Model not found**: `ollama list` → `ollama pull <model>`。

---

## デフォルト設定の推奨

| 用途 | 推奨 |
| --- | --- |
| 開発・検証（品質優先） | **Anthropic 本家**（Option A）— `anthropic:claude-sonnet-4-6` |
| 無料運用 | **Groq**（Option B）— `groq:llama-3.3-70b-versatile` |
| 条件付き代替 | OpenRouter BYOK（Option C）/ Ollama・GPU 環境（Option D） |

---

## プロバイダー切替時のチェックリスト

> 上記 Option A〜D のいずれかをそのまま使う場合は不要。**新規プロバイダーを追加・切替する際の確認リスト**。

`max_tokens_by_role.integration=8000` がプロジェクトの最低要件（[llm-integration.md](../design/llm-integration.md)）。

1. **AI SDK provider パッケージの有無** — 対象ベンダーの `@ai-sdk/*`（または互換 provider パッケージ）があるか。あれば `llm-client.ts` のレジストリに登録し `provider:model` で到達できる（ゲートウェイ不要）。無い場合のみゲートウェイ（[ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) 方向1）を任意層として検討する。
2. **Max Output Tokens ≥ 8000** — 統合 Agent の出力切れ防止。
3. **Context Window ≥ ~13K** — 入力 ~4.4K + 出力 ~8K = ~12.4K を収容。
4. **レート制限が実運用に耐えるか** — 1 実行で ~5 リクエスト消費を基準に評価。
5. **JSON 構造化出力の安定性** — 実機で競合調査テンプレを 1 実行し、Investigation の parse 成功率を確認（スペックが良くても不安定な例あり = Gemini）。

### 候補プロバイダーの位置づけ（dogfooding §7-4 / §7-11）

| プロバイダー | 無料枠 | API 形式 | 本アプリでの判定 |
| --- | --- | --- | --- |
| **Groq Llama 3.3 70B** | 30 RPM / 1,000 RPD / TPM 6,000 | OpenAI 互換 | **採用（無料ルート）** — `@ai-sdk/groq` でネイティブ到達・実測 4/4 完走 |
| Gemini 2.5 Flash | ~10 RPM / ~250 RPD / 1M context | OpenAI 互換 | 非推奨 — JSON 不安定・学習利用 |
| Cerebras | 1M tokens/day | OpenAI 互換 | 不可 — context cap 8,192 で入出力が収まらない |
| Mistral La Plateforme | 2 RPM | OpenAI 互換 | 不可 — 2 RPM で並列 Investigation が成立しない |
| DeepSeek V3 | サインアップ 500 万 tokens | OpenAI 互換 | 準無料（恒久無料でない）。未実機検証 |

---

## 関連

- [ADR-0034: LLM クライアントへの Vercel AI SDK Core 採用](../adr/0034-llm-client-ai-sdk.md)
- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0032: LLM マルチベンダー対応方式の選定（ゲートウェイ＝任意層）](../adr/0032-llm-multi-vendor-strategy.md)
- [ADR-0020: LLM SDK の選定（§1・§3 は ADR-0034 が supersede）](../adr/0020-llm-sdk-selection.md)
- [dogfooding §7: 無料 LLM API 市場調査と実機検証](../validation/dogfooding-log.md#7-無料-llm-api-市場調査と-adr-0029-再評価-issue-250)
