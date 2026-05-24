# LLM API 設定ガイド

Anthropic API、OpenRouter、Ollama から選択できます。既存コードの変更は不要で、環境変数の設定のみです。

参照: [ADR-0029](../adr/0029-free-llm-api-selection.md)

## 選択フロー

```text
LLM API の選択
  ├─ 最高品質を優先（推奨デフォルト）
  │  └─ Anthropic 本家
  │     - Claude Sonnet 4.6
  │     - 競合調査用途で最適
  │     - 従量課金
  │
  ├─ 無料で利用したい
  │  ├─ クラウド実行、レート制限OK
  │  │  └─ OpenRouter（無料モデル）
  │  │     - セットアップが簡単
  │  │     - スケーラブル
  │  │     - レート制限: 20 req/min, 50 req/day（$10 入金で 1,000 req/day へ緩和）
  │  │
  │  └─ ローカル実行、無制限実行したい
  │     └─ Ollama
  │        - 完全無料、無制限
  │        - ローカルスペック必要（40GB+）
```

## Option A: Anthropic 本家（推奨）

### セットアップ

1. **API キー取得**
   - [console.anthropic.com](https://console.anthropic.com) に登録
   - API Keys から `sk-ant-...` で始まるキーをコピー

2. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を設定
   LLM_API_KEY=YOUR_ANTHROPIC_API_KEY
   # LLM_BASE_URL は未設定（デフォルトで api.anthropic.com を使用）
   ```

3. **動作確認**

   ```bash
   # テストの実行
   bun run test
   ```

### 特徴

- 最高品質（Claude Sonnet 4.6）
- JSON 構造化出力が安定的
- 競合調査用途での品質優先
- 既に暫定運用中で、設定が確立している

---

## Option B: OpenRouter（代替・無料）

### 初期設定

1. **API キー取得**
   - [openrouter.ai](https://openrouter.ai) に登録
   - ダッシュボード → API Keys で `sk-or-...` で始まるキーをコピー

2. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を設定
   LLM_API_KEY=YOUR_OPENROUTER_API_KEY
   LLM_BASE_URL=https://openrouter.ai/api
   ```

3. **モデル選択**（無料モデルを使う場合）

   以下をいずれかに変更：

   ```bash
   # 汎用モデル（推奨）
   LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free  # Llama 3.3 70B

   # または推論タスク向け
   LLM_MODEL=deepseek/deepseek-r1:free  # DeepSeek R1

   # または コード生成向け
   LLM_MODEL=qwen/qwen3-coder:free  # Qwen 3 Coder
   ```

   利用可能なモデル一覧: [openrouter.ai/models](https://openrouter.ai/models)

4. **動作確認**

   ```bash
   # テストの実行
   bun run test
   ```

### モデル選択と max_tokens

本プロジェクトの統合 Agent は `max_tokens=8000` を要求する（3 社 × 4 観点のマトリクス生成で 3000 では出力切れになることを #205 ドッグフーディングで確認）。OpenRouter は個別リクエストの `max_tokens` を制限せず、モデルごとの Max Output に従う。要件を満たす無料モデルの選択は以下を参照：

- [openrouter.ai/models](https://openrouter.ai/models) で `Free` フィルタを適用し、Max Output が 8K 以上のモデルを選ぶ
- `:free` モデルのカタログは頻繁に変動するため、本ガイドにモデル一覧は記載しない（陳腐化を避けるため）

### レート制限の注意

無料ティアのレート制限は **2 段構え**で、後者が実用上のボトルネックになりやすい。

#### 1. OpenRouter 全体の制限

- 20 requests/minute（共通）
- 50 requests/day（クレジット未購入時、リセット: UTC 00:00）
- 1,000 requests/day（$10 入金で緩和）

#### 2. upstream provider の制限

`:free` モデルは OpenRouter が複数の upstream provider にルーティングするが、無料バリアントは backup provider が限定的で、provider 側の rate limit を踏むと `429 (Provider rate-limited)` が頻発する。さらに provider が一斉に落ちると `404 (No endpoints found)` も発生する。

```text
例: 同一 API キーで連続リクエストすると 3 モデルとも同じ provider (Venice 等)
    に振られ、1 つの provider 制限で全モデルが一時不通になる
```

**実運用の推奨**:

- 動作確認・短時間の検証用途に留める
- 本格運用は以下のいずれかを推奨:
  - Anthropic 本家（Option A）
  - OpenRouter で BYOK 設定（[Integrations 設定](https://openrouter.ai/settings/integrations) で Together / Groq 等の自前キーを登録すると自分のキー基準のレート制限になる）
  - Ollama（Option C）でローカル実行
- リトライ実装: Anthropic SDK の `maxRetries: 3` で 429 は自動リトライされるが、`retry_after_seconds` が長い場合は手動で別モデルへフォールバックも検討

**制限値の評価**: Investigation Agent 4 つ + Integration Agent 1 つで 1 実行あたり ~5 リクエスト消費するため、無購入だと OpenRouter 全体制限で 1 日 ~10 実行が上限。加えて provider 制限で更に削れるため、継続検証では BYOK か Ollama 切替を検討してください。

---

## Option C: Ollama（代替・ローカル無料）

### インストール

1. **Ollama をインストール**

   macOS:

   ```bash
   brew install ollama
   ```

   Linux:

   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

   Windows / その他: [ollama.ai](https://ollama.ai)

2. **Ollama を起動**

   ```bash
   ollama serve
   ```

   デフォルトで `http://localhost:11434` でリッスン開始

3. **モデルをダウンロード**

   別のターミナルで:

   ```bash
   # Llama 3.3 70B（推奨、40GB メモリ必要）
   ollama pull llama3.3:70b

   # または軽量版
   ollama pull mistral  # Mistral 7B
   ```

   ダウンロード時間: モデルサイズ + 回線速度に依存（数時間の場合もあり）

4. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を追加
   LLM_BASE_URL=http://localhost:11434
   LLM_API_KEY=ollama  # Ollama はキー認証不要。任意のダミー値を指定（llm-client.ts の検証回避用）
   ```

5. **動作確認**

   ```bash
   # テストの実行
   bun run test

   # または curl でエンドポイント確認
   curl -X POST http://localhost:11434/v1/messages \
     -H "Content-Type: application/json" \
     -d '{
       "model": "llama3.3:70b",
       "messages": [{"role": "user", "content": "Hello"}],
       "max_tokens": 100
     }'
   ```

### ローカルスペック要件

| モデル | メモリ | GPU | 推奨環境 |
| --- | --- | --- | --- |
| Mistral 7B | 16GB | 不要 | MacBook Pro M1/M2, RTX 3060 |
| Llama 3.1 8B | 16GB | 不要 | MacBook Pro M1/M2, RTX 3060 |
| Llama 3.3 70B | 40GB+ | NVIDIA/Metal | MacBook Pro M2 Max, RTX 4080/4090 |
| Llama 3.1 405B | 1.5TB+ | 8x A100/H100（80GB各） | 非推奨（エンタープライズ環境向け） |

### max_tokens の確認

Ollama は Modelfile の `num_predict` でモデルごとに出力上限が定義される（既定は `-1` = 無制限）。統合 Agent の `max_tokens=8000` を満たすには 70B 級モデル（Llama 3.3 70B 等）を推奨。7B 級は出力品質も低下しがちなので、競合調査用途では `bun run test` の出力で品質を確認してから本番投入してください。

---

## 設定値の確認

デバッグ時に実際の設定を確認：

```bash
# .env ファイルの確認
cat apps/api/.env

# または .env.local
cat apps/api/.env.local
```

## トラブルシューティング

### OpenRouter

#### 401 Unauthorized

```text
→ API キーが正しいか確認（sk-or-... で始まるか）
```

#### 429 Too Many Requests

```text
→ レート制限に達した。時刻をリセット時刻（UTC 00:00）まで待つか、
  リクエスト間隔を広げる
```

### Ollama

#### Connection refused

```text
→ ollama serve が起動しているか確認
  $ ollama serve
```

#### Model not found

```text
→ モデルがダウンロードされているか確認
  $ ollama list
  → ない場合は ollama pull <model-name>
```

---

## デフォルト設定の推奨

### 開発・検証用途（推奨）

**Anthropic 本家** をデフォルトに設定：

- 最高品質（Claude Sonnet 4.6）
- JSON 構造化出力の安定性
- 競合調査用途での品質を優先
- 既に暫定運用中で設定が確立している

### 無料で利用する場合

**OpenRouter（クラウド）** または **Ollama（ローカル）** から選択：

- **OpenRouter**: セットアップが簡単、スケーラブル、レート制限あり
- **Ollama**: 完全無料・無制限、ローカルスペック必要

---

## プロバイダー切替時のチェックリスト

新しい LLM プロバイダーへ切り替える前に以下を確認する。`max_tokens_by_role.integration=8000` がプロジェクトの最低要件（[llm-integration.md](../design/llm-integration.md) 参照）。

1. **Anthropic 互換 endpoint を提供しているか** — `/v1/messages` を実装していること。OpenAI 互換のみの場合は `llm-client.ts` の SDK 境界拡張が別途必要（[ADR-0020](../adr/0020-llm-sdk-selection.md)）
2. **対象モデルの Max Output Tokens が 8000 以上か** — 統合 Agent の出力切れを防ぐため
3. **対象モデルの Context Window が ~13K 以上か** — 入力 ~4.4K + 出力 ~8K = ~12.4K を収容するため
4. **レート制限が実運用に耐えるか** — 1 実行で ~5 リクエスト消費を基準に評価

### 不採用プロバイダー（参考）

調査済みだが現状の SDK 境界（Anthropic SDK ネイティブ）では採用しない選択肢。SDK 境界拡張を行う場合の候補として参考までに記録する。

| プロバイダー | 無料枠 | Max Output | Anthropic 互換 | 不採用理由 |
| --- | --- | --- | --- | --- |
| Groq | 30 RPM / 1000 RPD / TPM 6,000 | モデル依存 | ❌（OpenAI 互換のみ） | TPM 6,000 では 1 リクエストで 8000 tokens 出力が上限超過 |
| Google Gemini Flash | 1,500 RPD / 1M TPM | 無制限 | ❌（gateway 経由のみ） | SDK 境界拡張が必要 |
| Cerebras | 1M tokens/day | context cap 8,192 | ❌（OpenAI 互換のみ） | context cap が 8,192 で入力+出力が窮屈 |

---

## 関連

- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0020: LLM SDK の選定](../adr/0020-llm-sdk-selection.md)
