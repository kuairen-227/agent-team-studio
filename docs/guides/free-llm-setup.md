# LLM API 設定ガイド

LLM プロバイダは環境変数（`LLM_BASE_URL` / `LLM_API_KEY`）と DB テンプレの model で切り替える。アプリのコードは変更しない。

- **最高品質（推奨デフォルト）**: Anthropic 本家（有料・従量課金）
- **無料運用（推奨）**: Groq Llama 3.3 70B を **LiteLLM ゲートウェイ経由**で利用（実測で本アプリに実用的 — [dogfooding §7-11](../validation/dogfooding-log.md#7-11-実機検証の結果方向1-ゲートウェイ経由)）

参照: [ADR-0029（無料 LLM API の選定）](../adr/0029-free-llm-api-selection.md) / [ADR-0032（マルチベンダー対応方式 = ゲートウェイ）](../adr/0032-llm-multi-vendor-strategy.md)

> **背景（重要）**: 当初の無料ルート（OpenRouter `:free` / Ollama ローカル）は実機検証で前提が崩れた（`:free` は実質クレジット入金必須 #212 / Ollama は CPU 推論で速度不足 #229・#246）。代替候補（Gemini / Groq 等）は **いずれも Anthropic 非互換（OpenAI 互換のみ）** のため、本アプリ（Anthropic SDK ネイティブ）から使うには **変換ゲートウェイ**を挟む。実測の結果 **Groq が無料枠で最も実用的**、Gemini 無料枠は JSON 構造化出力が不安定で非推奨（後述）。

## 選択フロー

```text
LLM API の選択
  ├─ 最高品質を優先（推奨デフォルト）
  │  └─ Anthropic 本家（Option A）
  │     - Claude Sonnet 4.6 / 従量課金 / JSON 安定
  │
  ├─ 無料で利用したい（推奨）
  │  └─ Groq Llama 3.3 70B + LiteLLM ゲートウェイ（Option B）
  │     - 実測 4/4 完走・JSON 安定・マトリクス充実
  │     - 超高速・学習利用なし
  │     - 留意: free tier は TPM 6,000（連続/大入力で 429 リスク）
  │
  └─ 条件付きの代替
     ├─ OpenRouter BYOK（Option C）— :free は入金実質必須
     └─ Ollama（Option D）— GPU 推論環境が事実上の前提（CPU は実用不可）
```

## Option A: Anthropic 本家（推奨デフォルト）

### セットアップ

1. **API キー取得**: [console.anthropic.com](https://console.anthropic.com) → API Keys（`sk-ant-...`）
2. **環境変数**:

   ```bash
   # apps/api/.env
   LLM_API_KEY=YOUR_ANTHROPIC_API_KEY
   # LLM_BASE_URL は未設定（デフォルトで api.anthropic.com）
   ```

3. **動作確認**: `bun run test`

### 特徴

- 最高品質（Claude Sonnet 4.6）、JSON 構造化出力が安定、競合調査用途での品質基準
- 既に暫定運用中で設定が確立している

---

## Option B: Groq + LiteLLM ゲートウェイ（無料・推奨）

### なぜゲートウェイが必要か

Groq は **OpenAI 互換 API のみ**を提供し、Anthropic `/v1/messages` を話さない。本アプリは [ADR-0020](../adr/0020-llm-sdk-selection.md) で Anthropic SDK ネイティブを採用しているため、間に **Anthropic 形式を受けて OpenAI 互換へ変換するゲートウェイ**（[LiteLLM](https://docs.litellm.ai)）を挟む。これにより **アプリのコードは無変更**のまま Groq に到達できる（[ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) 方向1）。

```text
[app] --Anthropic /v1/messages--> [LiteLLM :4000] --OpenAI互換--> Groq
```

### セットアップ手順

1. **Groq API キー取得**: [console.groq.com](https://console.groq.com) → API Keys（`gsk_...`）。カード/入金不要。

2. **LiteLLM 設定ファイル** を用意（任意の場所、例 `litellm-config.yaml`）:

   ```yaml
   model_list:
     - model_name: llama-3.3-70b-versatile   # DB テンプレの model と一致させる
       litellm_params:
         model: groq/llama-3.3-70b-versatile
         api_key: os.environ/GROQ_API_KEY
   general_settings:
     master_key: sk-litellm-local            # アプリの LLM_API_KEY に設定する値
   ```

3. **LiteLLM を Docker で起動**。

   - **DevContainer 利用時（本リポジトリの標準）**: コンテナと同じ compose ネットワーク `agent-team-studio` に相乗りさせると、アプリは `http://litellm:4000` で名前解決できる（`host.docker.internal` 不要）:

     ```bash
     docker run --rm --name litellm --network agent-team-studio -p 4000:4000 \
       -e GROQ_API_KEY="gsk_..." \
       -v "$PWD/litellm-config.yaml:/app/config.yaml" \
       ghcr.io/berriai/litellm:main-latest --config /app/config.yaml --port 4000
     ```

   - **非コンテナ（ホストで直接アプリを動かす）場合**: `--network` を外し、`LLM_BASE_URL=http://localhost:4000` を使う。

4. **アプリ env を設定**（`apps/api/.env`）:

   ```bash
   LLM_BASE_URL=http://litellm:4000   # 非コンテナなら http://localhost:4000
   LLM_API_KEY=sk-litellm-local       # config.yaml の master_key と一致
   ```

5. **DB テンプレの model を切替**（model は `templates.definition.llm.model` に焼かれている。`seed.ts` は既存を上書きしないため SQL で更新）:

   ```bash
   psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"llama-3.3-70b-versatile\"') WHERE name = '競合調査';"
   ```

6. **動作確認**: `bun run dev` を再起動し、競合調査テンプレを 1 実行 → Investigation×4 / Integration×1 の完走を確認。

### 特徴・実測（dogfooding §7-11）

- 競合調査テンプレで **4/4 完走・JSON 安定・4 観点×3 社マトリクス充実**。無料枠としては §5 Anthropic 本家に最も近い品質。
- 超高速（数百 tok/s）、学習利用なしと明記。

### 留意点

- **free tier は TPM 6,000**（30 RPM / 1,000 RPD）。今回の単発実行では 429 は出なかったが、入力規模の増大・連続実行では `429 rate_limit` のリスクが残る。頻発する場合は Groq Dev tier、または OpenRouter BYOK（Option C）でレート枠を拡張する。
- Max Output 32,768 / Context 128K で本アプリ要件（Max Output ≥ 8K / Context ≥ ~13K）は満たす。

---

## Option C: OpenRouter（条件付き・BYOK 推奨）

OpenRouter は Anthropic 互換 endpoint を提供し `LLM_BASE_URL=https://openrouter.ai/api` で接続できるが、**`:free` モデルは実質クレジット入金が必要**なため「完全無料」ではない。

### 初期設定

1. **API キー取得**: [openrouter.ai](https://openrouter.ai) → API Keys（`sk-or-...`）
2. **環境変数**:

   ```bash
   LLM_API_KEY=YOUR_OPENROUTER_API_KEY
   LLM_BASE_URL=https://openrouter.ai/api
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

### 環境変数

```bash
LLM_BASE_URL=http://localhost:11434
LLM_API_KEY=ollama   # Ollama はキー認証不要。任意のダミー値（llm-client.ts の検証回避用）
```

```bash
psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"llama3.3:70b\"') WHERE name = '競合調査';"
```

### Windows + DevContainer での追加設定

DevContainer（Linux コンテナ）から Windows ホストの Ollama に到達するには `0.0.0.0` で listen させ、コンテキスト枠を拡張する（統合 Agent は ~12.4K トークン必要、デフォルト 4096 では出力切れ）:

```powershell
setx OLLAMA_HOST "0.0.0.0:11434"
setx OLLAMA_CONTEXT_LENGTH "16384"
```

`setx` は新規プロセスにのみ反映されるため、設定後は Ollama を完全終了→再起動する。DevContainer 内の `apps/api/.env` は `LLM_BASE_URL=http://host.docker.internal:11434` を指定。

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
- 利用する場合も Option B と同様に LiteLLM ゲートウェイ経由（`gemini/gemini-2.5-flash`）が必要。

---

## 設定値の確認・トラブルシューティング

```bash
cat apps/api/.env   # 現在の設定を確認
```

### Groq + LiteLLM

- **アプリから `litellm:4000` に繋がらない**: LiteLLM コンテナが `--network agent-team-studio` で起動しているか確認（`docker inspect litellm | grep -i network`）。
- **`LLM_API_KEY is not set` で起動失敗**: `apps/api/.env` の `LLM_API_KEY` が空。`master_key` の値を設定。
- **`429 rate_limit`（Groq）**: free tier TPM 6,000 超過。Dev tier / BYOK へ切替、またはリクエスト間隔を空ける。
- **`model not found`**: DB テンプレの model 文字列と `litellm-config.yaml` の `model_name` が不一致。

### OpenRouter

- **401**: API キー（`sk-or-...`）を確認。
- **429**: リセット（UTC 00:00）まで待つか間隔を広げる。**402**: クレジット残高不足（pre-flight reservation）。

### Ollama

- **Connection refused**: `ollama serve` 起動を確認。**Model not found**: `ollama list` → `ollama pull <model>`。

---

## デフォルト設定の推奨

| 用途 | 推奨 |
| --- | --- |
| 開発・検証（品質優先） | **Anthropic 本家**（Option A） |
| 無料運用 | **Groq + LiteLLM ゲートウェイ**（Option B） |
| 条件付き代替 | OpenRouter BYOK（Option C）/ Ollama・GPU 環境（Option D） |

---

## プロバイダー切替時のチェックリスト

`max_tokens_by_role.integration=8000` がプロジェクトの最低要件（[llm-integration.md](../design/llm-integration.md)）。

1. **API 形式** — Anthropic `/v1/messages` ネイティブならそのまま接続可。**OpenAI 互換のみ**の場合は LiteLLM ゲートウェイを挟む（[ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) 方向1・アプリ無変更）か、SDK 境界拡張（[ADR-0020](../adr/0020-llm-sdk-selection.md) 方針4 の Interface 抽出 ADR が必要）。
2. **Max Output Tokens ≥ 8000** — 統合 Agent の出力切れ防止。
3. **Context Window ≥ ~13K** — 入力 ~4.4K + 出力 ~8K = ~12.4K を収容。
4. **レート制限が実運用に耐えるか** — 1 実行で ~5 リクエスト消費を基準に評価。
5. **JSON 構造化出力の安定性** — 実機で競合調査テンプレを 1 実行し、Investigation の parse 成功率を確認（スペックが良くても不安定な例あり = Gemini）。

### 候補プロバイダーの位置づけ（dogfooding §7-4 / §7-11）

| プロバイダー | 無料枠 | API 形式 | 本アプリでの判定 |
| --- | --- | --- | --- |
| **Groq Llama 3.3 70B** | 30 RPM / 1,000 RPD / TPM 6,000 | OpenAI 互換 | **採用（無料ルート）** — ゲートウェイ経由で実測 4/4 完走 |
| Gemini 2.5 Flash | ~10 RPM / ~250 RPD / 1M context | OpenAI 互換 | 非推奨 — JSON 不安定・学習利用 |
| Cerebras | 1M tokens/day | OpenAI 互換 | 不可 — context cap 8,192 で入出力が収まらない |
| Mistral La Plateforme | 2 RPM | OpenAI 互換 | 不可 — 2 RPM で並列 Investigation が成立しない |
| DeepSeek V3 | サインアップ 500 万 tokens | OpenAI 互換 | 準無料（恒久無料でない）。未実機検証 |

---

## 関連

- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0032: LLM マルチベンダー対応方式の選定（ゲートウェイ）](../adr/0032-llm-multi-vendor-strategy.md)
- [ADR-0020: LLM SDK の選定](../adr/0020-llm-sdk-selection.md)
- [dogfooding §7: 無料 LLM API 市場調査と実機検証](../validation/dogfooding-log.md#7-無料-llm-api-市場調査と-adr-0029-再評価-issue-250)
