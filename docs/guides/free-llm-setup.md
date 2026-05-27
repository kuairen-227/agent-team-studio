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

   利用可能な無料モデル一覧: [openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models)（`:free` 接尾辞付きと Owl Alpha 等の stealth モデル両方を網羅。全モデル検索は [openrouter.ai/models](https://openrouter.ai/models)）

4. **動作確認**

   ```bash
   # テストの実行
   bun run test
   ```

### モデル選択と max_tokens

本プロジェクトの統合 Agent は `max_tokens=8000` を要求する（3 社 × 4 観点のマトリクス生成で 3000 では出力切れになることを #205 ドッグフーディングで確認）。OpenRouter は個別リクエストの `max_tokens` を制限せず、モデルごとの Max Output に従う。要件を満たす無料モデルの選択は以下を参照：

- [openrouter.ai/collections/free-models](https://openrouter.ai/collections/free-models) で無料モデル一覧から Max Output が 8K 以上のモデルを選ぶ（`:free` 接尾辞なしの stealth モデル含む）
- `:free` モデルのカタログは頻繁に変動するため、本ガイドにモデル一覧は記載しない（陳腐化を避けるため）

#### 重要: 無料モデルでもクレジット入金が実質必要

OpenRouter は `max_tokens` パラメータに基づく **pre-flight reservation（事前与信）** を行う。`:free` モデル（無料）であっても、`max_tokens` 分のコストをクレジット残高から予約しようとし、残高が足りないと 402 を返す。実際の応答が小さくても、`max_tokens` の上限値で予約される。

```text
例: max_tokens=1500 を要求し、利用可能枠が 756 tokens 分しか残っていない場合、
    無料モデルでも以下のエラーで失敗:

    LLM API error: 402
    "This request requires more credits, or fewer max_tokens.
     You requested up to 1500 tokens, but can only afford 756."
```

新規アカウントには小さな試用枠があるが、本プロジェクトの Investigation Agent (`max_tokens=1500`) / Integration Agent (`max_tokens=8000`) を継続実行するには **クレジット入金（$10〜）が事実上必須**。完全無料運用を希望する場合は Option C（Ollama）を選択してください。

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

> **本アプリでの実用判定（重要）**: Issue #229 のドッグフーディングで、**消費者向け CPU 推論（40 GB RAM / Intel Iris Xe）では本アプリの統合 Agent（`max_tokens=8000`）は事実上動かない**ことが判明した（[ドッグフーディングログ §6](../validation/dogfooding-log.md#6-ollama-検証-issue-229) 参照）。**Ollama は GPU 推論環境（NVIDIA CUDA / Apple Metal）が事実上の前提条件**。GPU を持たない場合は Option A / B を選択してください。

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

   Windows: [ollama.com/download/windows](https://ollama.com/download/windows) から `OllamaSetup.exe` を取得してインストール（管理者権限不要、約 700 MB）。インストール後はタスクトレイに常駐し、`http://localhost:11434` で API が起動する

2. **Ollama を起動**

   macOS / Linux:

   ```bash
   ollama serve
   ```

   Windows: インストール後は自動起動。手動起動はスタートメニューから「Ollama」を実行

3. **モデルをダウンロード**

   別のターミナルで:

   ```bash
   # Llama 3.3 70B（GPU 環境向け、40GB メモリ必要）
   ollama pull llama3.3:70b

   # または軽量版（GPU なしでも起動はできるが本アプリ実用は不可、後述）
   ollama pull llama3.1:8b
   ```

   ダウンロード時間: モデルサイズ + 回線速度に依存（数時間の場合もあり）

4. **環境変数を設定**

   ```bash
   # apps/api/.env または .env.local に以下を追加
   LLM_BASE_URL=http://localhost:11434
   LLM_API_KEY=ollama  # Ollama はキー認証不要。任意のダミー値を指定（llm-client.ts の検証回避用）
   ```

   テンプレートで使うモデルは DB の `templates.definition.llm.model` に焼かれている。Ollama 用に切り替える場合は SQL UPDATE で書き換える（`seed.ts` は既存レコードを上書きしないため）:

   ```bash
   psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"llama3.3:70b\"') WHERE name = '競合調査';"
   ```

5. **動作確認**

   ```bash
   # テストの実行
   bun run test

   # または curl でエンドポイント確認（Anthropic 互換 /v1/messages、v0.14+）
   curl -X POST http://localhost:11434/v1/messages \
     -H "Content-Type: application/json" \
     -H "x-api-key: ollama" \
     -H "anthropic-version: 2023-06-01" \
     -d '{
       "model": "llama3.3:70b",
       "messages": [{"role": "user", "content": "Hello"}],
       "max_tokens": 100
     }'
   ```

### Windows + DevContainer での追加設定

本リポジトリは DevContainer（Linux コンテナ）内で `apps/api` を起動するため、Ollama を Windows ホストで動かす場合は **DevContainer からホストへ到達できるよう Ollama を `0.0.0.0` で listen させる**必要がある。加えて、本アプリの統合 Agent は入力 ~4.4K + 出力 8K = ~12.4K トークンのコンテキストが必要なため、デフォルト 4096 では出力が切れる。

PowerShell（管理者権限不要、ユーザー環境変数で OK）:

```powershell
# 全 IF で listen させる（DevContainer から host.docker.internal で到達するため）
setx OLLAMA_HOST "0.0.0.0:11434"

# 入力 ~4.4K + 出力 8K に対応するコンテキスト枠
setx OLLAMA_CONTEXT_LENGTH "16384"
```

`setx` は新規プロセスにのみ反映されるため、設定後は **Ollama を完全に終了して再起動**する。タスクトレイから Quit、または PowerShell で `Get-Process | Where-Object { $_.Name -like "ollama*" } | Stop-Process -Force` → スタートメニューから再起動。`netstat -ano | findstr :11434` で `0.0.0.0:11434 ... LISTENING` を確認できれば成功。

DevContainer 内の `apps/api/.env` は `LLM_BASE_URL=http://host.docker.internal:11434` を指定する。

### ローカルスペック要件と実測値

「メモリ要件」だけでは本アプリで実用可能とは限らない。本アプリは [`llm-client.ts:28`](../../packages/agent-core/src/llm-client.ts) で Anthropic SDK の **timeout を 120 秒**に設定しているため、生成速度が遅すぎると Investigation Agent が時間切れで死ぬ。実用判定は **「トークン生成速度 × max_tokens が 120 秒以内に収まるか」** で行う必要がある。

| モデル | メモリ | GPU | 生成速度の目安 | 本アプリでの実用性 |
| --- | --- | --- | --- | --- |
| Mistral 7B / Llama 3.1 8B | 16GB | 不要（CPU） | 2-10 tok/s | △〜✕（後述・実測 2.38 tok/s で timeout 確定） |
| Mistral 7B / Llama 3.1 8B | 16GB | NVIDIA/Metal | 30-100 tok/s | ◯（GPU 推論なら Investigation Agent は 30 秒以内に収まる） |
| Llama 3.3 70B | 40GB+ | NVIDIA/Metal 必須 | 5-20 tok/s（GPU） | ◯（出力品質も統合 Agent に十分） |
| Llama 3.1 405B | 1.5TB+ | 8x A100/H100 | — | 非推奨（エンタープライズ向け） |

#### 実測ベース: CPU 推論は本アプリで使えない

Issue #229 のドッグフーディング（Windows / Intel Iris Xe / 40 GB RAM / CPU 推論 / `llama3.1:8b`）で計測した数値:

```text
HTTP 200  elapsed=113.41s  output_tokens=270  → 2.38 tok/s
```

この速度を本アプリの各 Agent に当てはめると:

| Agent | `max_tokens` | 必要時間（2.38 tok/s） | 120 秒 timeout 内に収まるか |
| --- | --- | --- | --- |
| Investigation × 4 並列 | 1500 | 約 630 秒 / agent | ✕（5 倍以上オーバー） |
| Integration | 8000 | 約 3360 秒（56 分） | ✕（論外） |

加えて、Llama 3.1 8B は学習データに **Dify / n8n / Zapier 等のドメイン固有プロダクトを十分含まない**ため、競合調査用途では出力品質も実用水準に達しない（モデルが「Dify を知らない」と回答し、fictional な架空機能を生成するケースを確認）。

### max_tokens / num_ctx の扱い

Ollama は Modelfile の `num_predict` でモデルごとに出力上限が定義される（既定は `-1` = 無制限）。本アプリの統合 Agent (`max_tokens=8000`) を完走させるには、上述のとおり **GPU 推論環境で 70B 級モデル**を推奨。`num_ctx`（コンテキストウィンドウ）はデフォルト 4096 のため、`OLLAMA_CONTEXT_LENGTH=16384` 等で明示的に拡張すること。

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
| Cerebras | 1M tokens/day | — (context cap 8,192 で制約) | ❌（OpenAI 互換のみ） | context cap が 8,192 で入力+出力が窮屈 |

---

## 関連

- [ADR-0029: 無料 LLM API の選定](../adr/0029-free-llm-api-selection.md)
- [ADR-0020: LLM SDK の選定](../adr/0020-llm-sdk-selection.md)
