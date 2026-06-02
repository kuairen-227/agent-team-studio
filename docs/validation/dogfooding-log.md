# ドッグフーディングログ

- **対象**: ADR-0005 成功基準 3（出力品質）/ 4（体感）
- **根拠 Issue**: #199 / 子 Issue #204（様式定義）/ #205（実施・結果）
- **成功基準 1・2 の扱い**: 基準 1（30 分以内完了）と 2（手動比 50% 削減）は #198 の MVP 検証プロトコル（受入確認）で別途判定。本ログのスコープ外。

---

## 1. 評価軸の定義

### 成功基準 3 — 出力品質

> 調査結果を基に提案資料のドラフトに着手できるレベルの構造・網羅性があること

| # | 評価軸 | 評価のポイント |
| - | --- | --- |
| Q1 | **網羅性** | 競合 3 社 × 4 観点（戦略 / 製品 / 投資 / パートナーシップ）のセルにすべて内容があるか |
| Q2 | **比較容易性** | 横断比較がしやすい構造・表現になっているか（マトリクス・並列表現が機能しているか） |
| Q3 | **根拠性** | 各セルの記述が具体的な情報源（参考情報やモデル知識）に基づいており、空論でないか |
| Q4 | **再利用性** | そのまま（または軽微な編集で）提案資料のドラフトに組み込めるレベルか |

### 成功基準 4 — 体感

> ドッグフーディングで「手動より明確に楽」と判断できること

| # | 評価軸 | 評価のポイント |
| - | --- | --- |
| E1 | **入力負荷** | テンプレート入力・パラメータ設定が迷わずできたか（フォームの分かりやすさ） |
| E2 | **待機時の安心感** | エージェント実行中、進捗が見えて「ちゃんと動いている」と感じられたか |
| E3 | **結果到達感** | 最終結果が表示された時、「欲しかったものが得られた」と感じたか |
| E4 | **手動比の主観** | 全体を通して、手動（LLM チャット）と比べて「明確に楽」と言えるか |

---

## 2. 評価基準

各軸を以下の 3 段階で評価する。

| 評価 | 基準 |
| --- | --- |
| **OK** | 基準を満たしている。改善不要 |
| **課題あり** | 概ね機能しているが、改善の余地がある |
| **NG** | 基準を満たしていない。優先的に改善が必要 |

---

## 3. 実施方法（1 名運用）

1 名（エンジニア兼 PM）が MVP を操作し、PM 視点とエンジニア視点を切り替えながら評価する。

| 役割 | 視点 | 重点 |
| --- | --- | --- |
| PM 視点 | 非エンジニアとして UC を体験 | 体感（E1〜E4）と出力の事業利用可能性（Q4） |
| エンジニア視点 | 実装者として機能を観察 | 出力の技術的品質（Q1〜Q3）とシステムの挙動 |

操作中に思ったことをメモしておき、終了後に各軸を採点する。

---

## 4. 記録様式

### 4-1. 実施メタデータ

```text
実施日: YYYY-MM-DD
実施者:
使用シナリオ: 競合 3 社（Dify / n8n / Zapier）× 4 観点（戦略 / 製品 / 投資 / パートナーシップ）
アプリ URL / 環境:
アプリ SHA: （完全 SHA 40 文字を記録する）
```

### 4-2. 操作メモ（随時記入）

```text
[開始 → 入力フォーム]
-

[実行 → 進捗表示]
-

[結果確認]
-
```

### 4-3. 出力品質評価

| 評価軸 | 評価 | 自由記述 |
| --- | --- | --- |
| Q1 網羅性 | OK / 課題あり / NG | |
| Q2 比較容易性 | OK / 課題あり / NG | |
| Q3 根拠性 | OK / 課題あり / NG | |
| Q4 再利用性 | OK / 課題あり / NG | |

### 4-4. 体感評価

| 評価軸 | 評価 | 自由記述 |
| --- | --- | --- |
| E1 入力負荷 | OK / 課題あり / NG | |
| E2 待機時の安心感 | OK / 課題あり / NG | |
| E3 結果到達感 | OK / 課題あり / NG | |
| E4 手動比の主観 | OK / 課題あり / NG | |

### 4-5. 成功基準判定

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| 成功基準 3（出力品質） | PASS / CONDITIONAL / FAIL | Q1〜Q4 の評価に基づく |
| 成功基準 4（体感） | PASS / CONDITIONAL / FAIL | E1〜E4 の評価に基づく |

#### 判定ガイドライン

| 判定 | 条件 |
| --- | --- |
| PASS | NG が 0 件、かつ 課題あり が 1 件以下 |
| CONDITIONAL PASS | NG が 0 件、かつ 課題あり が 2 件以上 |
| FAIL | NG が 1 件以上 |

### 4-6. 課題リスト

合議（本プロジェクトでは PM / エンジニア視点の切り替えで代替）の上、以下に分類する。

**分類基準**: 成功基準の合否に影響する、または UX 上ユーザーが困惑するレベルの問題 → **修正必要**。機能しているが体験を改善できる余地がある → **v2 候補**。

| # | 課題内容 | 評価軸 | 分類 |
| - | --- | --- | --- |
| | | | 修正必要 / v2 候補 |

---

## 5. 実施結果（#205 完了後に記入）

### 5-1. 実施メタデータ

```text
実施日: 2026-05-23
実施者: kaito sasaki（PM / エンジニア兼任 + Claude Sonnet 4.6 がブラウザ操作を代行）
使用シナリオ: 競合 3 社（Dify / n8n / Zapier）× 4 観点 × 参考情報あり（各社 100〜150 字）
アプリ URL / 環境: http://localhost:5173
アプリ SHA: ec61d35
所要時間: 約 2 分（フォーム入力 1 分 + エージェント実行 1 分）
```

### 5-2. 操作メモ

```text
[開始 → 入力フォーム]
- テンプレート一覧（/）に「競合調査」1 件が表示されている。説明文・エージェント構成が確認できる
- カードをクリック → /templates/.../new へ遷移。「入力フォーム」見出しとテンプレート説明が再表示される
- 「競合企業名」フィールドは 1 件からスタート。「競合企業を追加」ボタンで動的に最大 5 件まで追加できる
- 実行ボタンは企業名未入力時に disabled になる（バリデーション正常）
- 参考情報（任意）テキストエリアにプレースホルダーと文字数上限（10000 字）が表示されている
- 調査観点（4 つ固定）は入力画面に表示されない — 何が調査されるか完全には入力前に把握できない点が軽微な課題

[実行 → 進捗表示]
- 「実行する」クリック → /executions/{id} へ即時遷移（ページ遷移でのフィードバックが明快）
- エージェント一覧に 5 件（投資調査・提携調査・製品調査・戦略調査・統合）が表示される
- 4 つの調査エージェントが並列で「実行中」ステータスになり、それぞれのストリーミング出力がリアルタイムで表示される
- 「何かが動いている」感が強く、待機中の不安はほぼない
- 4 エージェント完了後、統合エージェントが「待機」→「実行中」へ移行し、マトリクス生成をストリーミング表示
- 統合エージェントの出力にはまずマトリクス表が流れ、続いて総合インサイト、最後に内部 JSON が表示される
- 約 2 分で全エージェントが「完了」となり「実行完了」画面に遷移

[結果確認]
- 4 観点 × 3 社 = 12 セルのマトリクステーブルが整然と表示される
- 各セルに「確度: 強/中/弱/不足」ラベルが付いており、エビデンスの信頼度が一目でわかる
- 「総合インサイト」セクション（箇条書き 5 件）が自動付与され、横断的な気づきを提供
- 「Markdown をコピー」「ダウンロード」ボタンで次のアクションへ誘導される
- 投資観点の Zapier セルに「確度: 不足」が表示され、情報欠如を正直に示している点が◎
```

### 5-3. 出力品質評価

| 評価軸 | 評価 | 自由記述 |
| --- | --- | --- |
| Q1 網羅性 | OK | 4 観点 × 3 社 = 12 セルがすべて埋まり、総合インサイト 5 点も付与。情報不足セルも「不足」として明示 |
| Q2 比較容易性 | OK | 観点行 × 企業列のテーブルで横断比較が一目でできる。列幅均等で読みやすい |
| Q3 根拠性 | 課題あり | 「確度」ラベルで信頼度を示し、情報不足は正直に明記する設計は良い。ただし出典 URL はなく、LLM 知識依存の部分は検証不可 |
| Q4 再利用性 | OK | Markdown コピー / ダウンロードで即輸出できる。マトリクス＋インサイト構成は提案資料のドラフト着手に十分な品質 |

### 5-4. 体感評価

| 評価軸 | 評価 | 自由記述 |
| --- | --- | --- |
| E1 入力負荷 | OK | テンプレート選択→フォーム→実行の導線が明快。動的追加 UI も直感的。調査観点が入力前に見えない点は軽微な課題 |
| E2 待機時の安心感 | OK | 4 エージェントが並列でリアルタイムストリーミング。「動いている」感が強く、離脱衝動は発生しなかった |
| E3 結果到達感 | OK | 「実行完了」見出し＋マトリクス＋インサイト＋エクスポートボタンの構成で「欲しかったものが揃った」感がある |
| E4 手動比の主観 | OK | フォーム入力 + 2 分の待機で整形済みマトリクスが得られた。手動（LLM チャット + 手動整形）より明確に楽 |

### 5-5. 成功基準判定

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| 成功基準 3（出力品質） | PASS | NG なし、課題あり 1 件（Q3 出典なし）。構造・網羅性・再利用性はいずれも OK |
| 成功基準 4（体感） | PASS | NG なし、課題あり 0 件。E1〜E4 すべて OK。特に E2（並列ストリーミング）と E4（手動比）が強い |

（判定基準は §4-5 を参照）

### 5-6. 課題リスト

| # | 課題内容 | 評価軸 | 分類 |
| - | --- | --- | --- |
| 1 | 統合エージェントの max_tokens（3000）が 3 社×4 観点で不足し出力解析エラーが発生した → 8000 へ修正済み | — | 修正済み |
| 2 | 入力フォームに調査観点（4 つ固定）が表示されない — 何が調査されるか入力前に完全には分からない | E1 | v2 候補 |
| 3 | LLM エラー時のエラー画面メッセージが「LLM エラー」のみで、ユーザーへの案内が不十分（→ #214） | E2 | 修正必要 |
| 4 | 履歴一覧にフィルタリング機能がなく、失敗・完了が混在して視認性が低い | E3 | v2 候補 |
| 5 | 出典 URL が表示されないため、確度「不足」「弱」セルの情報を独立検証できない | Q3 | v2 候補 |
| 6 | seed テストが不在のため、SSoT 転記ミス（max_tokens 等）を自動検出できない（→ v2 で不変条件テスト追加を検討） | — | v2 候補 |
| 7 | `bun run db:seed` は既存レコードをスキップするため、seed 定義変更が既存 DB に自動反映されない（今回は SQL 直接更新で対処） | — | v2 候補 |

### 5-7. 総評

> **成功基準 3（出力品質）**: PASS。Dify / n8n / Zapier の 4×3 マトリクス（12 セル）が完全生成され、確度ラベル・情報不足の明示・総合インサイト付与の設計は提案資料への転用に十分な品質。出典 URL の欠如は課題だが、ADR-0005 成功基準の「提案資料ドラフトに着手できるレベル」は満たす。
>
> **成功基準 4（体感）**: PASS。並列エージェントのリアルタイムストリーミングが「チームが動いている」価値を体感させることに成功。入力からマトリクス取得まで約 2 分で、手動 LLM チャット + 手動整形と比較して「明確に楽」と判断できる。
>
> **副産物として発見したバグ**: 統合エージェントの max_tokens=3000 は 3 社以上の場合に出力が切れ出力解析エラーになる。8000 へ修正済み（seed ファイル更新済み）。
>
> **DB 直接更新（dev 環境限定の一時対処）**: `bun run db:seed` は冪等だが既存テンプレートを上書きしないため、今回は以下の SQL で DB を直接更新した。再シード時は seed スクリプト側の値が適用されるため、prod 環境では `db:seed` の再実行を推奨。
>
> ```sql
> UPDATE templates SET definition = jsonb_set(definition, '{llm,max_tokens_by_role,integration}', '8000') WHERE name = '競合調査';
> ```

---

## 6. Ollama 検証 (Issue #229)

ADR-0029 で「無料代替案（ローカル）」として採用した Ollama を、消費者向けノート PC スペックで実際に試した結果。完全無料運用の現実的な可否を判定する。

### 6-1. 検証メタデータ

```text
実施日: 2026-05-27
実施者: kaito sasaki（PM / エンジニア兼任 + Claude Opus 4.7 が DevContainer 側オペレーションを代行）
検証対象: Issue #229（Ollama でローカル LLM 動作確認 — 完全無料運用の選択肢検証）
比較対象: §5 の Anthropic 本家（Claude Sonnet 4.6）実施結果
検証 PC スペック:
  - OS: Windows
  - GPU: Intel(R) Iris(R) Xe Graphics（CPU 内蔵、Ollama 加速対象外）
  - 専用 VRAM: なし
  - RAM: 40 GB
  - 推論モード: CPU 推論
検証モデル: llama3.1:8b（Q4、約 4.7 GB）
  - 70B クラスは 40 GB RAM では OOM 確定のため、最初から 8B を選択
アプリ環境: DevContainer から host.docker.internal:11434 経由で Windows 側 Ollama に接続
```

### 6-2. セットアップ手順と疎通確認結果

| ステップ | 結果 |
| --- | --- |
| Ollama Windows ネイティブインストール | OK |
| `OLLAMA_HOST=0.0.0.0:11434` / `OLLAMA_CONTEXT_LENGTH=16384` 設定 + Ollama 再起動 | OK（`netstat` で `0.0.0.0:11434 LISTENING` 確認） |
| DevContainer から `/v1/messages`（Anthropic 互換）疎通 | OK（HTTP 200、8.5 秒で 3 トークン応答） |
| `apps/api/.env` を Ollama 向けに設定 | OK |
| DB テンプレートの model フィールドを `llama3.1:8b` に更新 | OK（SQL UPDATE） |

接続経路は問題なし。Ollama v0.14+ の `/v1/messages` Anthropic 互換エンドポイントに既存 SDK そのまま接続できることを確認した。

### 6-3. 実測: トークン生成速度

接続疎通後、速度計測目的の短縮プロンプト（`List 5 features of Dify in JSON array format.`）を `max_tokens=500` で実行（生成速度はモデル・コンテキスト長依存で、本番 Agent への外挿時の差は軽微と判断）:

```text
HTTP 200  elapsed=113.41s
usage: { input_tokens: 22, output_tokens: 270 }
stop_reason: end_turn
output_tokens/sec: 2.38
```

**実測 2.38 tok/s**。Ollama 公式の参考値や本 Issue 検討段階の見積（CPU 推論 7-8B Q4 で 5-10 tok/s）の下限を下回る。

### 6-4. 致命的制約: SDK タイムアウトとの整合

[`llm-client.ts:28`](../../packages/agent-core/src/llm-client.ts) で Anthropic SDK の `timeout: 120_000`（2 分）を設定している。実測速度に対して本アプリの各 Agent は以下のとおり成立しない:

| Agent | `max_tokens` | 必要時間（2.38 tok/s） | 120 秒 timeout 内 |
| --- | --- | --- | --- |
| Investigation × 4 並列 | 1500 | 約 630 秒（10.5 分） | ✕ 5 倍以上オーバー |
| Integration | 8000 | 約 3360 秒（56 分） | ✕ 論外 |

本アプリのコードを変更せずに使う前提では、現スペック + 8B モデルでは **Investigation Agent の段階で SDK timeout により確実に失敗**する。

### 6-5. 副次的所見: モデル知識の不足

実測時のレスポンスを見ると、`llama3.1:8b` は「Dify を知らない」と正直に回答し、その後 fictional な架空機能を生成した:

> "I couldn't find any information on what 'Dify' is, which makes it difficult to provide a list of its features. ... However, if you'd like me to create a fictional example..."

競合調査用途では **モデルが対象プロダクトを学習データに含むか** が出力品質の前提条件になる。Llama 3.1 8B は Dify / n8n / Zapier 等のドメイン固有プロダクト情報を十分には持たないため、仮に時間制約を回避できたとしても**出力品質が§5 の Anthropic 本家結果に到底及ばない**ことが判明した。

### 6-6. 受け入れ条件判定

| # | 受け入れ条件 | 判定 | 根拠 |
| - | --- | --- | --- |
| 1 | Ollama でモデルが起動・応答する | ✅ OK | curl/疎通とも HTTP 200 |
| 2 | 本アプリの競合調査が 1 回成功 | ❌ NG | Investigation Agent が SDK timeout で失敗（10.5 分必要 vs 2 分上限） |
| 3 | 出力品質の所感を記録 | ✅ OK | 本 §6 に記録（所感としては NG: モデル知識不足 + fictional 生成） |
| 4 | スペック要件を free-llm-setup.md に反映 | ✅ OK | CPU 推論 / 70B 不可 / 実測 2.38 tok/s / GPU 必須 を追記 |

### 6-7. 結論

**現スペック（消費者向けノート PC + CPU 推論）では本アプリの Ollama 運用は不可**。

理由:

- 生成速度（2.38 tok/s）が SDK timeout（120 秒）に対し桁が違う
- 8B モデルでは競合調査ドメインに必要なプロダクト知識が不足
- 70B モデルは 40 GB RAM では OOM のため検証不可

ADR-0029 の「ローカル無料代替案」としての Ollama の前提（**GPU 推論環境を持つこと**）を本ログ §6-4 / free-llm-setup.md に明示した。GPU を持たない学習プロジェクト運用者にとっての完全無料運用パスは、現状以下のいずれかに収束する:

1. OpenRouter BYOK（Together / Groq 等の自前キー）
2. Anthropic 本家の従量課金（少額運用）
3. GPU 環境を別途用意して Ollama 70B（本検証スコープ外）

**Issue #229 の受け入れ条件 2（本アプリで 1 回成功）は現スペックでは満たせないため、Issue 上のクローズ判断は本ログ + free-llm-setup.md 更新をもって「検証完了・結論: 現スペックでは不可」とする**。GPU 環境での再検証は本プロジェクトの方針としては実施しない（検証用 GPU 環境を確保できないため）。完全無料運用パスを必要とする場合は、上記 3 候補（OpenRouter BYOK / Anthropic 少額従量 / 別途 GPU 環境）から選択する。

## 7. 無料 LLM API 市場調査と ADR-0029 再評価 (Issue #250)

ADR-0029 が採用した 2 ルート（OpenRouter `:free` / Ollama ローカル）が両方とも実機で前提を覆された（§6 / #212 / #246）ため、別ルート（Gemini / Groq 等）を市場調査し、本アプリで実機検証して ADR-0029 を再評価する。本節は **市場調査フェーズ**（携帯/DevContainer で完結する範囲）の結果と、実機検証フェーズの **PC 引き継ぎ runbook** を記録する。

### 7-1. 調査メタデータ

```text
実施日: 2026-06-02
フェーズ: 市場調査（実機検証は PC 引き継ぎ）
本アプリ要件（docs/design/llm-integration.md より）:
  - Investigation Agent ×4 並列: temperature 0.3 / max_tokens 1,500 / 入力 ~3,500 → 1 リクエスト ~5,000 tokens
  - Integration Agent ×1:       temperature 0.2 / max_tokens 8,000 / 入力 ~4,400 → 1 リクエスト ~12,400 tokens
  - 1 実行 = ~5 リクエスト / SDK timeout 120 秒（llm-client.ts:28）
  - 切替点は LLM_BASE_URL + LLM_API_KEY（Anthropic SDK の /v1/messages を前提）
選定の必須条件:
  - Max Output Tokens ≥ 8,000（Integration の出力切れ防止）
  - Context Window ≥ ~13K（入力 ~4.4K + 出力 ~8K = ~12.4K）
  - Anthropic /v1/messages を話せる（話せない場合はブリッジ or コード変更が必要 → 7-2）
```

### 7-2. 決定的所見: 候補は全て「非 Anthropic 互換（OpenAI 互換のみ）」

調査した候補（Gemini / Groq / Cerebras / DeepSeek / Mistral / GitHub Models / Together / Fireworks）は **いずれもネイティブな Anthropic `/v1/messages` を提供しない**。すべて OpenAI Chat Completions 互換（一部は独自形式併設）。これは ADR-0029 が Groq / Gemini を「コード変更必要」として却下した壁と同一で、2026 年時点でも解消していない。

本アプリは ADR-0020 で Anthropic SDK ネイティブ（`client.messages.stream()` → `/v1/messages`）を採用しているため、これら候補に到達するには次のいずれかが必要:

| 方式 | 概要 | アプリのコード変更 | ADR への影響 |
| --- | --- | --- | --- |
| A. 変換ゲートウェイ/プロキシ | LiteLLM / Braintrust gateway / `groq-for-claude-code` 等が `/v1/messages` を受け、OpenAI 互換へ変換して各ベンダーへ転送 | **不要**（`LLM_BASE_URL` をプロキシに向けるのみ） | ADR-0029 の「コード変更なし」思想を維持。プロキシ採用を ADR に記録 |
| B. SDK 境界の拡張 | `llm-client.ts` に OpenAI 互換クライアント対応を追加 | 必要 | ADR-0020 が義務付ける **Interface 抽出 ADR** が必要（2 つ目の provider 形状の現実化） |

### 7-3. 学習ポイント: マルチベンダー LLM 対応のベストプラクティス

複数ベンダーのモデルを 1 つのアプリで扱う際の業界標準パターンは 3 つ。本アプリの選定はこの軸で整理できる。

1. **ゲートウェイ/プロキシ層**（LiteLLM・OpenRouter・Portkey・Cloudflare AI Gateway・Braintrust 等）
   - アプリは単一エンドポイント（多くは OpenAI 互換、一部は Anthropic 互換）にだけ話し、ベンダー差はゲートウェイが吸収する。
   - 利点: アプリ無変更でベンダー追加／切替、認証・リトライ・フォールバック・コスト計測・可観測性を 1 箇所に集約。
   - 欠点: ホップが 1 つ増える（レイテンシ・障害点）、データが経由先を通る（OSS の LiteLLM をローカル/自前ホストすれば緩和できる）。
2. **アプリ内アダプタ抽象化**（自前の `LlmProvider` インターフェース + ベンダー別実装）
   - 利点: 外部依存なし、境界を自分で所有。
   - 欠点: ストリーミング差・エラー形・トークナイザ差を自分で保守。本プロジェクトでは ADR-0020 が Interface 抽出 ADR を要求する。
3. **OpenAI 方言への一本化**
   - 事実上の業界標準は OpenAI Chat Completions であり、大半のベンダー（Groq/Gemini/Cerebras/DeepSeek/Mistral/Together/Fireworks）が OpenAI 互換を提供し、**Anthropic が外れ値**。「OpenAI 方言を話す」アプリは到達可能ベンダーが最大化する。
   - 本アプリは ADR-0020 で Anthropic SDK を採用したため、いまこの標準から外れたコスト（= 7-2 のブリッジ必要性）を払っている。

**本プロジェクト（ADR-0002 学習目的）への含意**:

- **短期（検証フェーズ）**: 方式 A（LiteLLM をローカル起動）が最小コスト。アプリ無変更で Gemini/Groq に到達でき、ADR-0029 の「コード変更なし」思想と整合する。→ 7-7 runbook はこれを主軸にする。
- **中長期（恒久運用）**: 「OpenAI 互換を第一級の SDK 境界にするか」を ADR で判断する論点になる。寄せれば到達ベンダーが最大化するが、ADR-0020（Anthropic SDK ネイティブ）の supersede が必要。検証結果を見て判断する。

### 7-4. 無料枠スペック比較表

> レート制限・無料枠はベンダーが頻繁に変更する。下表は 2026 年 6 月時点の調査値（出典は 7-9）。**実運用前に各 console で最新値を必ず確認すること**（= マルチベンダー運用のベストプラクティスの 1 つ）。

| サービス / モデル | 無料枠（RPM / RPD / TPM） | Context | Max Output | API 形式 | データ利用 | 本アプリ適合（要点） |
| --- | --- | --- | --- | --- | --- | --- |
| **Gemini 2.5 Flash** | ~10 RPM / ~250 RPD / ~250K TPM（要 console 確認。過去は 15 / 1,500 / 1M） | 1M | 65,536 | OpenAI 互換 + 独自（Anthropic 非対応） | ⚠️ **無料枠はプロンプトが学習に利用される**（有料/Vertex は対象外） | TPM・Context・Max Output いずれも余裕。RPD 250 でも 1 実行 ~5 req で ~50 実行/日。**ブリッジ必須 + プライバシー留意** |
| **Groq / Llama 3.3 70B (versatile)** | 30 RPM / 1,000 RPD / **6,000 TPM** / 500K TPD | 128K | 32,768 | OpenAI 互換（Anthropic 非対応） | 学習利用なしと明記 | 超高速（数百 tok/s）だが **TPM 6,000 が致命的**: Integration 単発 ~12.4K tokens が 1 分枠を超過。Dev tier / BYOK が事実上前提。ブリッジ必須 |
| Cerebras / Llama 3.x | 30 RPM / 1M TPD / 60–100K TPM | **8,192（暫定上限）** | — | OpenAI 互換 | — | Context 8,192 では 入力 ~4.4K + 出力 8K = ~12.4K が収まらず **Integration 不可** |
| DeepSeek (V3) | サインアップ 500 万 tokens（30 日）、以降従量（激安）。ハードな RPM 制限なし | 64K | 8,192 | OpenAI 互換 | — | コーディング系で高品質・準無料。**恒久無料ではない**。ブリッジ必須 |
| Mistral La Plateforme | 10 億 tokens/月 / **2 RPM** | 128K（Codestral 256K） | モデル依存 | OpenAI 互換 | — | **2 RPM で Investigation ×4 並列が即 429**。ブリッジ必須 |
| GitHub Models | アカウントのみ・低レート（検証用） | モデル依存 | モデル依存 | Azure / OpenAI 互換 | — | プロトタイプ用途。継続運用枠は限定的 |
| Together AI | $25 サインアップクレジット | モデル依存 | モデル依存 | OpenAI 互換 | — | 試用クレジット型（**恒久無料でない**） |
| Fireworks AI | $1 サインアップクレジット | モデル依存 | モデル依存 | OpenAI 互換 | — | 試用クレジット型（少額・**恒久無料でない**） |

### 7-5. 絞り込み結果（実機検証の対象）

要件（Max Output ≥ 8K / Context ≥ ~13K / レート現実性）と Issue の受け入れ条件から、実機検証フェーズの対象を以下に絞る。

| 優先度 | サービス | 採否理由 |
| --- | --- | --- |
| 一次（必須） | **Gemini 2.5 Flash** | スペックは全要件を満たす。残る論点は「ブリッジ経由の疎通」と「無料枠の学習利用（プライバシー）」のみ。検証価値が最も高い |
| 一次（必須） | **Groq / Llama 3.3 70B** | 受け入れ条件で必須。ただし **TPM 6,000 で Integration 完走は free tier では困難**な見込み。Dev tier / BYOK 切替も視野に検証する |
| 二次（任意・推奨） | **DeepSeek V3** | OpenAI 互換・高品質・準無料。サインアップクレジットで 1 実行は十分検証可能 |
| 除外 | Cerebras | Context 8,192 で Integration の入出力が収まらない |
| 除外 | Mistral | 2 RPM で並列 Investigation が成立しない |
| 除外 | GitHub Models / Together / Fireworks | 恒久無料でない、または検証用低レート枠のみ。一次/二次が不調な場合の予備 |

### 7-6. 受け入れ条件の進捗（市場調査フェーズ分）

| # | 受け入れ条件 | フェーズ | 状態 |
| - | --- | --- | --- |
| 1 | 候補の無料枠仕様を比較表で整理 | 市場調査 | ✅ 完了（7-4） |
| 2 | Gemini（Flash）で競合調査テンプレートが 1 回成功 | 実機検証 | ⏳ PC 引き継ぎ（7-7） |
| 3 | Groq（Llama 3.3 70B）で 1 回成功 | 実機検証 | ⏳ PC 引き継ぎ（TPM 制約に留意） |
| 4 | 有望な二次候補を追加検証（任意） | 実機検証 | ⏳ PC 引き継ぎ（DeepSeek 推奨） |
| 5 | 各候補の評価軸を記録 | 実機検証 | ⏳ PC 引き継ぎ（本 §7 に追記） |
| 6 | ADR-0029 を更新し無料運用ルートを再決定 | 再決定 | ⏳ 検証結果待ち（方式は ADR-0032 で proposed 化） |
| 7 | free-llm-setup.md を再構成 | 再決定 | ⏳ 再決定後 |

> **方式選定の進展**: 「候補が全て非 Anthropic 互換」への対応方式（ゲートウェイ / Vercel AI SDK / 自前 interface）は [ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) として `proposed` で起草済み。短期（検証）=方向1 ゲートウェイ、中長期=実測待ちで方向2′（自前 interface）候補・方向2 は非推奨。詳細・評価軸は §7-10。

### 7-7. PC 引き継ぎ runbook（実機検証フェーズ）

実機検証は API キー発行・外部 egress・ゲートウェイ起動・アプリ実行を伴うため、それらが可能な環境（egress のある PC 等）で実施する。方向1（Anthropic 互換ゲートウェイ）を採る（[ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) 短期方針）。

**ゲートウェイ実体は pip 専用ではない**。本リポジトリは TS モノレポであり Python/pip は前提ではない。Anthropic `/v1/messages` を受けて OpenAI 互換へ変換できれば手段は問わない。代表的な選択肢:

- LiteLLM proxy（Docker / `uvx` / `pipx` 等、pip 直叩き以外でも起動可）
- Anthropic 互換 endpoint を提供するホスト型ゲートウェイ（ローカルプロセス不要）
- 軽量な自前 TS プロキシ（恒久運用にするなら ADR-0032 方向2′ への移行を検討）

**前提**: 本リポジトリを clone 済み、`bun run dev` で起動でき、対象ベンダーへ外部 egress できること。

1. **API キー発行（カード/クレジット入金不要）**
   - Gemini: [aistudio.google.com](https://aistudio.google.com) → Get API key（`AIza...`）
   - Groq: [console.groq.com](https://console.groq.com) → API Keys（`gsk_...`）。free tier の TPM 6,000 制約に留意
   - （任意）DeepSeek: [platform.deepseek.com](https://platform.deepseek.com) → API Keys
2. **Anthropic 互換ゲートウェイを起動**（`/v1/messages` を受けて OpenAI 互換へ変換するブリッジ。実体は上記の選択肢から選ぶ）
   - 例: LiteLLM proxy を Docker / `uvx litellm` 等で起動（pip 直叩きは必須ではない）
   - `config.yaml` に `model_list` を定義（例: `gemini/gemini-2.5-flash` / `groq/llama-3.3-70b-versatile`）、各 `*_API_KEY` を env で渡す
   - `litellm --config config.yaml` で `http://localhost:4000` 起動。Anthropic 形式の入力受理を有効化（LiteLLM の Anthropic `/v1/messages` パススルー）
3. **アプリ env を差し替え**（`apps/api/.env`）
   - `LLM_BASE_URL=http://host.docker.internal:4000`（DevContainer から到達するため。ホスト直なら `http://localhost:4000`）
   - `LLM_API_KEY=<LiteLLM master key（未設定ならダミー文字列）>`（`llm-client.ts` のロード時検証回避用）
   - DB テンプレートの model を切替（§6 の Ollama 手順と同形式の SQL UPDATE）:

     ```bash
     # Gemini で検証する場合（Groq は 'llama-3.3-70b-versatile' に差し替え）
     psql "$DATABASE_URL" -c "UPDATE templates SET definition = jsonb_set(definition, '{llm,model}', '\"gemini-2.5-flash\"') WHERE name = '競合調査';"
     ```

   - `max_tokens=8000`（Integration）が各モデルの Max Output 内であることを確認（Gemini 65,536 / Groq 32,768 とも OK）
4. **疎通確認**

   ```bash
   curl -X POST http://localhost:4000/v1/messages \
     -H "Content-Type: application/json" \
     -H "x-api-key: $LLM_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'
   ```

   → HTTP 200 が返れば次へ。
5. **テンプレート 1 実行**: 競合調査テンプレートを起動し、**Investigation ×4 + Integration ×1 が全て完了**することを確認。
   - Groq は TPM 6,000 で `429` が出る可能性 → リクエスト間隔を空ける / Dev tier・BYOK へ切替を検討
   - Gemini は RPD 250 / RPM ~10 の範囲内（1 実行 ~5 req なので余裕）
6. **品質比較（Issue §3）**: 出力を §5（Anthropic 本家）と比較し、評価軸を本 §7 に追記する:
   - JSON 構造化出力の安定性（パース成功率・スキーマ準拠）
   - マトリクスの整合性（3 社 × 4 観点の欠落・矛盾）
   - ドメイン知識の網羅性（Dify / n8n / Zapier 等の実在機能を正しく把握しているか）
   - 無料枠の実態（疎通可否・完走可否・遭遇したレート制限・所要時間）
7. **二次候補（任意）**: DeepSeek を同様に LiteLLM 経由で 1 実行。
8. **再決定**: 結果をもとに **ADR-0029 を更新**（現実的な無料/低コスト運用ルートの再決定 — 方式 A のプロキシ採用を含むか、Anthropic 少額従量 / OpenRouter BYOK 継続かを判断）し、**`free-llm-setup.md` を再構成**する。方式 B（SDK 境界拡張）を選ぶ場合は ADR-0020 supersede の新 ADR を別途切る。

### 7-8. 結論（市場調査フェーズ）

- 候補は全て **非 Anthropic 互換**。本アプリで使うには **ブリッジ（推奨: LiteLLM プロキシ・アプリ無変更）か SDK 境界拡張（要 ADR）** が必須。
- スペック上の実機検証対象は **Gemini 2.5 Flash（本命）/ Groq Llama 3.3 70B（TPM 制約に留意）/ DeepSeek V3（任意・準無料）**。Cerebras・Mistral・GitHub Models・Together・Fireworks は要件未達または恒久無料でないため除外/予備。
- ADR-0029 の再決定と free-llm-setup.md 再構成は **実機検証の結果を待って** 実施する（7-7 runbook で PC に引き継ぐ）。

### 7-9. 出典

- Gemini OpenAI 互換のみ（Anthropic 非対応）: [OpenAI compatibility | Gemini API](https://ai.google.dev/gemini-api/docs/openai)、[Call Gemini with the Anthropic SDK | Braintrust](https://www.braintrust.dev/articles/call-gemini-with-anthropic-sdk)
- Gemini 無料枠・学習利用: [Rate limits | Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits)、[Gemini API Free Tier 2026 | TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- Gemini 2.5 Flash Context/Max Output: [Models | Gemini API](https://ai.google.dev/gemini-api/docs/models)
- Groq に Anthropic エンドポイントなし（feature request 段階）: [Feature Request: Anthropic API Endpoint | Groq Community](https://community.groq.com/t/feature-request-anthropic-api-endpoint/380)、[groq-for-claude-code（変換プロキシ）](https://github.com/wearedevx/groq-for-claude-code)
- Groq 無料枠（30 RPM / 1,000 RPD / 6,000 TPM）: [Rate Limits | GroqDocs](https://console.groq.com/docs/rate-limits)、[Groq Free Tier 2026 | TokenMix](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- Groq Llama 3.3 70B Context/Max Output: [Llama-3.3-70B-Versatile | GroqDocs](https://console.groq.com/docs/model/llama-3.3-70b-versatile)
- Cerebras（1M tokens/day・8,192 context cap・OpenAI 互換）: [Cerebras Free Tier 2026 | TokenMix](https://tokenmix.ai/blog/cerebras-api-key-rate-limits-free-tier-2026)、[OpenAI Compatibility | Cerebras](https://inference-docs.cerebras.ai/resources/openai)
- DeepSeek / Mistral 無料枠・OpenAI 互換: [Free LLM APIs 2026 | TokenMix](https://tokenmix.ai/blog/free-llm-apis-2026-every-provider-free-tier-tested)
- GitHub Models 無料枠: [GitHub Models billing | GitHub Docs](https://docs.github.com/billing/managing-billing-for-your-products/about-billing-for-github-models)
- Together $25 / Fireworks $1 クレジット: [Together AI Free Credits 2026](https://www.getaiperks.com/en/ai/together-ai-free-credits-2026)、[Fireworks AI Free Tier 2026](https://pricepertoken.com/endpoints/fireworks/free)
- LiteLLM Anthropic `/v1/messages` 対応: [Anthropic API Compatibility | LLM Gateway docs](https://docs.llmgateway.io/features/anthropic-endpoint)

### 7-10. 方式選定（ADR-0032）と実機検証への引き継ぎ

§7-2 の「候補は全て非 Anthropic 互換」への対応方式を [ADR-0032](../adr/0032-llm-multi-vendor-strategy.md)（`proposed`）として選定した。これは ADR-0020 方針4 が予約した「2 つ目 provider 現実化時の Interface 抽出再評価」の正規発火に当たる。

**Architect 視点の比較結論**（マトリクス全体は ADR-0032 §Considered Alternatives）:

| フェーズ | 採る方式 | 根拠（要点） |
| --- | --- | --- |
| 短期（実機検証） | **方向1 ゲートウェイ** | アプリ無変更で複数ベンダーを横並び比較、恒久採用ベンダー未確定の段階で自前抽象を書く手戻りを回避（本質志向・節度・MVP整合） |
| 中長期（恒久運用） | **実測待ちで分岐** | Anthropic 少額従量 / OpenRouter BYOK 継続なら新規対応不要。OpenAI 互換ベンダー恒久採用なら方向1 恒久化 or 方向2′（自前 interface・ADR-0020 方針4 の正規ルート）。**方向2（Vercel AI SDK）は非推奨** |

**決定的事実（誠実さのため記録）**: agent 経路（`agent.ts`）は `LlmInput`（model/system/user/temperature/max_tokens）と `AsyncIterable<string>`（text_delta 結合）のみ使用。thinking / citations / prompt caching / tool use はリポジトリ全体で未使用。ADR-0020 が Anthropic SDK 採用の主根拠とした「Claude 固有機能追従」は agent 経路で一度も行使されていない。

**実機検証で記録する品質評価軸（受け入れ条件 #5 のフレーム）**: 7-7 step 5–6 で各候補（Gemini / Groq / 任意 DeepSeek）を §5（Anthropic 本家）と比較し、以下を本 §7 に追記する。

| 軸 | 測り方 |
| --- | --- |
| 無料枠の実態 | 疎通可否 / Investigation×4 + Integration×1 の完走可否 / 遭遇したレート制限（429 等）/ 所要時間 |
| JSON 構造化出力の安定性 | パース成功率・スキーマ準拠（マトリクス JSON が崩れないか） |
| マトリクスの整合性 | 3 社 × 4 観点の欠落・矛盾の有無 |
| ドメイン知識の網羅性 | Dify / n8n / Zapier 等の実在機能を正しく把握しているか |
| データプライバシー | 宛先の学習利用ポリシー（Gemini 無料枠は学習利用される点に留意） |

**この環境（市場調査セッション）での実行不可点**: 外部 egress が遮断され API キーも未発行のため、実走（受け入れ #2/#3/#5 の実測部分）は egress のある環境に引き継ぐ。設計・方式選定（ADR-0032）・runbook 整備はこのセッションで完了済み。

**残タスク（egress 環境で実施）**: ①7-7 runbook で Gemini / Groq を実走し上表を埋める → ②結果をもとに ADR-0032 を `accepted` 化または恒久方式へ supersede → ③ADR-0029 を再決定 → ④`free-llm-setup.md` を再構成。

### 7-11. 実機検証の結果（方向1 ゲートウェイ経由）

実施日: 2026-06-02 / 構成: ホスト Docker で LiteLLM を `agent-team-studio` ネットワークに相乗り（`LLM_BASE_URL=http://litellm:4000`）。**アプリのコードは無変更**。競合調査テンプレ（competitors=Dify/n8n/Zapier）を各候補で実行。

**ゲートウェイ方式の成立を確認**: 方向1（LiteLLM・アプリ無変更）で Gemini / Groq 両方に疎通でき、ADR-0032 の短期方針が実機で成立した。

#### 評価軸の測定結果

| 軸 | Gemini 2.5 Flash（2 回） | Groq Llama 3.3 70B（1 回） | §5 Anthropic 本家（基準） |
| --- | --- | --- | --- |
| 疎通 | ✅ | ✅ | ✅ |
| exec 完走（status=completed） | ✅ 両回 | ✅ | ✅ |
| Investigation 完走率 | ❌ **不安定**: 1 回目 2/4・2 回目 1/4 のみ成功 | ✅ **4/4** | ✅ 4/4 |
| JSON 構造化出力の安定性 | **低**: `output_parse_error` 多発（残りが空マトリクスに） | **高**: パース・スキーマ準拠とも成功 | 高（基準） |
| マトリクスの整合性（3 社 × 4 観点） | **実質空**: 全観点「情報不足」、欠落多数 | 4 観点中 3 観点が充実、investment のみ「情報不足」を honest に missing 計上 | 充実（基準） |
| ドメイン知識の網羅性 | 評価不能（出力が空） | 概ね妥当（n8n=OSS/カスタムノード、Zapier=1000+ 統合/非テク層は正確）。ただし数値（Dify の「月額 9.99 ドル」等）は**参考値扱い・一次情報での確認が必要**で、未確認のまま提案資料に転記しないこと | 高（基準） |
| 所要時間 | ~18 秒 | ~46 秒 | 未計測（基準実行は §5 で品質評価のみ・時間未記録） |
| レート制限（429） | なし | なし（今回。TPM 6,000 の制約は残存し、入力増・連続実行では 429 リスクあり） | — |
| データプライバシー | ⚠️ 無料枠はプロンプトが学習利用される | 学習利用なしと明記 | — |

#### 所見

- **Groq Llama 3.3 70B が本アプリの構造化出力に対して実用的**。4/4 完走・JSON 安定・マトリクス充実で、無料枠としては §5 に最も近い品質。「Investigation Agent 間で情報に齟齬あり」と自己申告する overall_insights まで生成した。
- **Gemini 2.5 Flash はスペック上は最強だが、本アプリでは不安定**。2 回とも Investigation の過半が `output_parse_error` で脱落し、実質的な分析結果を得られなかった。これは ADR-0029 が「非 Sonnet 系で JSON 安定性が落ちる」と挙げたリスクの実証。
  - **誠実な補足**: 本アプリの parser（`agent.ts` の `parseInvestigationOutput`）は先頭/末尾の ` ```json ` フェンスを除去するのみの厳格実装。Gemini が前置き散文や別形式を返すと脱落する。parser を寛容化すれば一部回復する可能性はあるが、**現状のアプリのまま**では Gemini 無料枠は信頼できない、というのが実測結論。
- **TPM 6,000 の壁は今回は顕在化せず**。ただし 1 回のクリーン実行が上限を否定するものではない（入力規模・連続実行で 429 リスクは残る）。
- スペック表（§7-4）の予測（Gemini 本命 / Groq は TPM 懸念）に対し、**実測では逆転**（Groq が品質で勝り、Gemini は JSON 安定性で脱落）。スペックと実機品質は別物、という学習。

#### 受け入れ条件の最終状態

| # | 条件 | 状態 |
| - | --- | --- |
| 2 | Gemini（Flash）で 1 回成功 | ✅（部分）exec は完走（status=completed）。ただし JSON 不安定で実質出力は空マトリクスのため、全面成功ではなく非推奨の根拠として記録 |
| 3 | Groq（Llama 3.3 70B）で 1 回成功 | ✅ 完走・品質良好 |
| 4 | 二次候補（DeepSeek 等）追加検証（任意） | ⏭️ 未実施（キー未発行・任意のため）。必要なら同 runbook で追試可 |
| 5 | 各候補の評価軸を記録 | ✅ 本節 |
| 6 | ADR-0029 を再決定 | ✅ Groq（ゲートウェイ経由）を無料ルートに再決定（[ADR-0029 §再決定](../adr/0029-free-llm-api-selection.md) / [ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) 短期方向1 accepted） |
| 7 | free-llm-setup.md を再構成 | ✅ Groq + LiteLLM ゲートウェイを Option B（推奨無料ルート）に再構成 |
