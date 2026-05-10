# 無料 LLM API のセットアップガイド

z.ai 有料化対応として、無料で利用可能な LLM API を 2 つの選択肢から選定できます。既存コードの変更は不要で、環境変数の設定のみです。

参照: [ADR-0029](../adr/0029-free-llm-api-selection.md)

## 選択フロー

```
開発・検証用途か？
  ├─ クラウド実行、レート制限OK
  │  └─ OpenRouter（推奨）
  │     - セットアップが簡単
  │     - スケーラブル
  │     - レート制限: 20 req/min, 200 req/day
  │
  └─ ローカル実行、無制限実行したい
     └─ Ollama（代替案）
        - 完全無料、無制限
        - ローカルスペック必要（40GB+）
```

## Option A: OpenRouter（推奨）

### セットアップ手順

1. **API キー取得**
   - https://openrouter.ai に登録
   - ダッシュボード → API Keys で `sk-or-...` で始まるキーをコピー

2. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を追加
   LLM_API_KEY=sk-or-...  # OpenRouter API キー
   LLM_BASE_URL=https://openrouter.ai/api
   ```

3. **モデル選択**（オプション）

   デフォルトは `claude-sonnet-4-6` ですが、無料モデルを使う場合は以下をいずれかに変更：

   ```bash
   # 汎用モデル（推奨）
   LLM_MODEL=llama-3.3-70b-specdec  # Llama 3.3 70B
   
   # または推論タスク向け
   LLM_MODEL=deepseek-r1  # DeepSeek R1
   
   # または コード生成向け
   LLM_MODEL=qwen/qwen-coder-480b  # Qwen 3 Coder 480B
   ```

   > **利用可能なモデル一覧**: https://openrouter.ai/models

4. **動作確認**

   ```bash
   # テストの実行
   bun run test
   
   # または curl でエンドポイント確認
   curl -X POST https://openrouter.ai/api/v1/messages \
     -H "Authorization: Bearer sk-or-..." \
     -H "Content-Type: application/json" \
     -d '{
       "model": "llama-3.3-70b-specdec",
       "messages": [{"role": "user", "content": "Hello"}],
       "max_tokens": 100
     }'
   ```

### レート制限の注意

無料ティアのレート制限:
- 20 requests/minute
- 200 requests/day（リセット: UTC 00:00）

Investigation Agent 4 つを並列実行した場合、単一実行で ~5 リクエスト消費するため、レート制限に引っかからないように注意してください。

---

## Option B: Ollama（代替案）

### セットアップ手順

1. **Ollama をインストール**

   macOS:
   ```bash
   brew install ollama
   ```

   Linux:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

   Windows / その他: https://ollama.ai

2. **Ollama を起動**

   ```bash
   ollama serve
   ```

   > デフォルトで `http://localhost:11434` でリッスン開始

3. **モデルをダウンロード**

   別のターミナルで:

   ```bash
   # Llama 3.3 70B（推奨、40GB メモリ必要）
   ollama pull llama2:70b
   
   # または軽量版
   ollama pull mistral  # Mistral 7B
   ```

   > ダウンロード時間: モデルサイズ + 回線速度に依存（数時間の場合もあり）

4. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を追加
   ANTHROPIC_BASE_URL=http://localhost:11434
   ```

   > `LLM_API_KEY` は不要（ローカル実行のため）

5. **動作確認**

   ```bash
   # テストの実行
   bun run test
   
   # または curl でエンドポイント確認
   curl -X POST http://localhost:11434/v1/messages \
     -H "Content-Type: application/json" \
     -d '{
       "model": "llama2:70b",
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

**401 Unauthorized**
```
→ API キーが正しいか確認（sk-or-... で始まるか）
```

**429 Too Many Requests**
```
→ レート制限に達した。時刻をリセット時刻（UTC 00:00）まで待つか、
   リクエスト間隔を広げる
```

### Ollama

**Connection refused**
```
→ ollama serve が起動しているか確認
   $ ollama serve
```

**Model not found**
```
→ モデルがダウンロードされているか確認
   $ ollama list
   → ない場合は ollama pull <model-name>
```

---

## デフォルト設定の推奨

学習・開発用途では **OpenRouter 推奨**：

- セットアップが簡単
- スケーラブル（クラウド）
- テスト環境での選択肢が豊富

本番環境やプライベート環境では **Ollama 検討**：

- 完全無料・無制限
- データが社内に閉じる
- ローカルスペックが確保できる場合

---

## 関連

- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0020: LLM SDK の選定](../adr/0020-llm-sdk-selection.md)
