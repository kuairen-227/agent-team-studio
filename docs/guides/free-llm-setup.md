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
  │  │     - レート制限: 20 req/min, 200 req/day
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
   LLM_MODEL=llama-3.3-70b-specdec  # Llama 3.3 70B

   # または推論タスク向け
   LLM_MODEL=deepseek-r1  # DeepSeek R1

   # または コード生成向け
   LLM_MODEL=qwen/qwen-coder-480b  # Qwen 3 Coder 480B
   ```

   利用可能なモデル一覧: [openrouter.ai/models](https://openrouter.ai/models)

4. **動作確認**

   ```bash
   # テストの実行
   bun run test
   ```

### レート制限の注意

無料ティアのレート制限（クレジット未購入時）:

- 20 requests/minute
- 50 requests/day（リセット: UTC 00:00）

注: 10 以上のクレジット購入で 1000 requests/day に緩和されます。

**制限値の評価**: Investigation Agent 4 つを並列実行した場合、単一実行で ~5 リクエスト消費するため、50 req/day では実運用に不十分。必要に応じて Ollama への切り替えや OpenRouter へのクレジット投入を検討してください。

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
   ```

   `LLM_API_KEY` は不要（ローカル実行のため）

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

## 関連

- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0020: LLM SDK の選定](../adr/0020-llm-sdk-selection.md)
