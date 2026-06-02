# 0032. LLM マルチベンダー対応方式の選定（ADR-0020 一部再評価）

## Status

accepted（短期方針 = 方向1 を採用。中長期の恒久方式は条件付きで保留）

- 作成日: 2026-06-02
- 関連: ADR-0020（再評価対象・方針4 が本 ADR を予約）, ADR-0029（前提・本 ADR の方式で無料ルートを再決定）, Issue #250

> **確定状況（2026-06-02）**: 短期方針 **方向1（ゲートウェイ）を accepted** とする。Issue #250 の実機検証（`docs/validation/dogfooding-log.md` §7-11）で LiteLLM ゲートウェイ・アプリ無変更により Gemini/Groq へ疎通でき、Groq Llama 3.3 70B が実用品質で完走することを確認した。これを受け [ADR-0029](./0029-free-llm-api-selection.md) は無料ルートを Groq（ゲートウェイ経由）に再決定した。
>
> **中長期（恒久方式）は引き続き保留**。下記 Decision のとおり、Anthropic 少額従量 / OpenRouter BYOK 継続なら現状維持、OpenAI 互換ベンダー恒久採用ならゲートウェイ恒久化 or 方向2′（自前 interface）へ移行。いずれを採るかは運用実績を見て判断し、必要時に本 ADR を更新する。

## Context

ADR-0029（無料 LLM API 選定）が採用した 2 ルートが、いずれも実機検証で前提を覆された:

- OpenRouter `:free`: pre-flight reservation 仕様によりクレジット入金が事実上必須（#212）
- Ollama ローカル: 消費者向け CPU 推論では生成速度が SDK timeout に対し桁違いに不足（#229 / PR #246）

別ルート（Gemini / Groq 等）を Issue #250 で市場調査した結果、**決定的所見**が出た（`docs/validation/dogfooding-log.md` §7-2）: 調査した候補（Gemini / Groq / Cerebras / DeepSeek / Mistral / GitHub Models / Together / Fireworks）は **いずれもネイティブな Anthropic `/v1/messages` を提供しない**。すべて OpenAI Chat Completions 互換である。

本アプリは ADR-0020 で Anthropic SDK ネイティブ（`client.messages.stream()` → `/v1/messages`）を採用しており、これら候補に到達するには「Anthropic ⇄ OpenAI 形式の変換」をどこかに置く必要がある。これは ADR-0020 が方針4 で予約した再評価トリガそのものである:

> 方針4「Interface 抽出は、2 つ目の provider 採用が現実化した時点で抽出する（Rule of Three）。その時点で本 ADR の方針 2 を一部 superseded する ADR を切る」
> 再評価条件「OpenAI / Google 等への切り替え・並行運用方針が決まる / 単一 provider 前提を崩す要件（AI Gateway 経由ルーティング等）が出る → 自前 interface 抽出 vs Vercel AI SDK を改めて比較する」

§7-2 で OpenAI 互換の 2 つ目 provider 形状が現実化したため、本 ADR で対応方式を選定する。

### 前提となる事実確認（誠実さのため明示）

`packages/agent-core` の agent 経路（`agent.ts`）が LLM に渡すのは `LlmInput`（`model` / `system` / `user` / `temperature` / `max_tokens`）のみで、受け取るのは `AsyncIterable<string>`（`text_delta` の結合）のみである。**thinking / citations / prompt caching / tool use はリポジトリ全体で未使用**。すなわち ADR-0020 が Anthropic SDK 採用の主根拠とした「Claude 固有機能への最速追従」は、現実の agent 経路では一度も行使されていない。この事実は方式選定で「Anthropic ネイティブへの固執を解除してよい」根拠となる。

また `llm-client.ts` の公開境界は既に `LlmInput` + `AsyncIterable<string>` で Anthropic SDK 型を遮断済み（ADR-0020 方針2 が達成済み）。

## Considered Alternatives

| # | 方式 | 概要 | アプリのコード変更 | ADR-0020 への影響 |
| - | --- | --- | --- | --- |
| 1 | ゲートウェイ層 | アプリは Anthropic 形式のまま、`LLM_BASE_URL` を Anthropic 互換ゲートウェイ（LiteLLM 等のローカル/自前ホスト変換層、または Anthropic 互換 endpoint を持つホスト型）に向ける。ゲートウェイが各 OpenAI 互換ベンダーへ変換・転送 | **不要** | **不要**（provider 形状が境界に現れず公開型不変。方針2 のまま） |
| 2 | Vercel AI SDK | `ai` + `@ai-sdk/anthropic` / `@ai-sdk/google` / `@ai-sdk/groq` 等で `llm-client.ts` を再構成 | 必要（全置換 + 依存追加） | 方針2 を一部 supersede（新 ADR 必須）。さらに ADR-0020 却下理由C の判断を覆す根拠が要る |
| 2′ | 自前 `LlmProvider` interface | `LlmProvider` interface を抽出し、Anthropic 実装 + OpenAI 互換実装を用意 | 必要（interface + 実装） | 方針2 を一部 supersede（新 ADR 必須）。方針4 が予約した正規ルート |

### 評価マトリクス

| 評価軸 | 方向1 ゲートウェイ | 方向2 Vercel AI SDK | 方向2′ 自前 interface |
| --- | --- | --- | --- |
| コード変更量 | ◎ ゼロ（`LLM_BASE_URL` のみ） | △ `llm-client.ts` 全置換 + 依存追加 | ○ `llm-client.ts` 内 + interface 追加 |
| ADR-0020 整合（Interface 抽出義務） | ◎ provider 形状が境界に現れず抽出不要。方針2 のまま | △ 抽出するが「SDK の抽象へ委譲」で自前 interface とは別物。supersede 必須 | ◎ 方針4 が想定した抽出そのもの。義務を正面から満たす |
| 運用集中化（認証/リトライ/FB/コスト/可観測） | ◎ ゲートウェイに集約 | △ アプリ内に分散。FB・コスト計測は自前 | △ アプリ内に分散。自前実装 |
| データプライバシー | ○ 自前ホストで経由先を所有（学習利用は宛先依存: Gemini 無料枠は学習利用、Groq は推論専用で学習利用なし） | ○ 直結（学習利用は宛先依存） | ○ 直結（学習利用は宛先依存） |
| レイテンシ・障害点 | △ ホップ +1。自前ホストで局所化可 | ◎ 直結 | ◎ 直結 |
| 学習価値（ADR-0002） | ○ ゲートウェイ運用・API 標準化を体験 | △ ベンダー差が SDK の裏に隠れる | ◎ ストリーミング差・エラー形・トークナイザ差を自分で保守＝最大 |
| MVP 整合・YAGNI・節度 | ◎ 検証に最小コスト | △ 単一 provider 段階では過剰（却下理由C のまま） | ○ 2 件目現実化が前提なら抵触せず |
| Claude 固有機能喪失の影響 | ─ 非該当 | ─ 非該当 | ─ 非該当 |
| streaming/AbortSignal/timeout 差異吸収 | ◎ ゲートウェイが Anthropic SSE で吸収・アプリ無変更 | △ AI SDK API へ書換・挙動検証要 | △ ベンダーごとに自前吸収 |

凡例: ◎優 ○良 △難 ─非該当

> 「Claude 固有機能喪失の影響」行は全案「─ 非該当」で選定の差異化には寄与しない。agent 経路で thinking/citations/prompt caching/tool use を未行使のため今回は差がつかない、という事実を明示する目的で残す（将来これらを使う場合は再評価軸となる）。

### 各案の決定的 long / short

- **方向1 ゲートウェイ** — long: アプリ無変更で全 OpenAI 互換ベンダーに到達、ADR-0029 の「コード変更なし」思想を維持、検証を即開始できる。short: 恒久運用ではプロキシの起動・設定・ホスティングが運用責務になり、1 人運用では重い。障害点が +1。
- **方向2 Vercel AI SDK** — long: provider パッケージ追加でベンダー増、streaming/リトライ抽象が SDK 側。short: ADR-0020 却下理由C（自前 WebSocket スタックで `useChat` 等の真価を活かせない）が今も成立。provider 抽象を SDK に委譲するため方針4 が要求する自前 interface とは別物で結局 supersede が要る。**本アプリ固有の優位が存在しない**。
- **方向2′ 自前 interface** — long: 方針4 が明示的に予約した道、Rule of Three の 2 件目が現実化した今が抽出タイミング、学習価値最大、外部依存ゼロ。short: ストリーミング差・エラー形・OpenAI 互換クライアントを自前保守。恒久採用ベンダー未確定の段階で書くと手戻りリスク。

## Decision

**フェーズ分離を採る**。短期と中長期で最適解が割れるため、一括では決めない。短期方針（方向1）を accepted とし、中長期の恒久方式は実測を踏まえて後日確定する。

### 短期（検証フェーズ）: 方向1 ゲートウェイ

Issue #250 の実機検証（Gemini / Groq の疎通・完走・品質比較）は **方向1（Anthropic 互換ゲートウェイ）** で行う。

- 恒久採用ベンダーが未確定の段階で自前 interface を書くのは「2 件目の形状が確定する前の抽出」であり、ADR-0020 却下理由C が警告した手戻りに当たる（本質志向・節度・MVP整合）。
- アプリ無変更で複数ベンダーを横並び比較でき、手戻りがゼロ。`dogfooding-log.md` §7-7 runbook はこの前提で組まれている。
- ゲートウェイ実体（LiteLLM ローカル等）の選定・手順は ADR ではなく runbook で扱う（実装詳細のため）。

### 中長期（恒久運用）: 実測待ちで分岐（方向2′ を候補、方向2 は非推奨）

恒久運用の方式は **無料ルート（Groq ゲートウェイ経由）の運用実績が蓄積されるまで保留**する（設計判断の先送りではなく、判断に必要な運用データ待ち）。実機検証（§7-11）で短期方針の成立と品質は確認済みだが、恒久化の可否はプロキシ常駐の運用負荷・レート制限の実害を継続運用で観測しないと判断できないため。**確定判断のトリガ**: 無料ルートを数週間の実利用で回し、429 発生率・ゲートウェイ運用の手間・品質安定性を観測した時点で下表に従い恒久方式を確定する。収束先により分岐する:

- **Anthropic 少額従量に戻す / OpenRouter BYOK 継続** で落ち着くなら → **新規対応不要**。ADR-0020・ADR-0029 はそのまま。最も節度的。
- **Gemini / Groq 等 OpenAI 互換ベンダーを恒久採用** するなら →
  - プロキシ常駐を許容できる運用（ゲートウェイを CI／開発フローに組み込め、セルフホスト環境を継続保守できる、の双方を満たす）なら方向1 を恒久化（supersede 不要・運用責務 +1）。これを満たせない場合は次項を採る。
  - プロキシ常駐が 1 人運用で重い、または学習価値（ADR-0002）を取るなら **方向2′ へ移行**（ADR-0020 方針4 の正規ルート。新 ADR で `LlmProvider` interface を抽出し ADR-0020 方針2 を一部 supersede）。

**方向2（Vercel AI SDK）は非推奨**。理由は好みではなく、ADR-0020 却下理由C（自前 WebSocket スタックで AI SDK の主価値を活かせない）＋ Claude 固有機能が agent 経路で未行使＝ provider 抽象の対価に見合う固有便益がない、で一貫する。なお ADR-0025（TanStack Router 採用）・ADR-0026（TanStack Query 採用）後もフロント基盤＝ React + Vite + Hono + 自前 WebSocket は不変で、却下理由C の前提（`useChat` 等の真価を自前 WS スタックで活かせない）は今も成立することを確認済み。

### ADR-0020 / ADR-0029 の扱い

| 最終的に採る方式 | ADR-0020 への操作 | 新 ADR |
| --- | --- | --- |
| 方向1（短期） | supersede 不要（公開型不変・方針2 のまま） | 不要。ADR-0029 §再決定 で対応済み |
| 方向1（恒久化） | supersede 不要（公開型不変・方針2 のまま） | 不要。本 ADR の更新のみ（Status を恒久化 accepted に） |
| 方向2′ | 方針2 を一部 supersede。Status を `accepted（一部 superseded by NNNN）` に更新（ADR-0016 と同形式） | 新 ADR 必須（interface 抽出 + 2 実装） |
| 現状維持 | 操作なし | 不要 |

短期方針（方向1）では provider 形状が公開境界に現れず ADR-0020 の公開型は不変のため、ADR-0020 の supersede は不要。ADR-0029 は本 ADR の短期方針（ゲートウェイ）に基づき無料ルートを Groq に再決定済み（同 ADR §再決定）。恒久方式が方向2′ に収束した場合のみ、上表に従い ADR-0020 方針2 を一部 supersede する。

## Consequences

### ポジティブ

- **再評価の正規化** — ADR-0020 方針4 が予約したトリガに正面から応答し、選定根拠を追跡可能にした。
- **検証を即開始できる** — 短期方針（方向1・アプリ無変更）により、実機検証フェーズが環境（egress + API キー）さえ揃えば着手できる。
- **手戻り回避** — 恒久方式の決定を実測まで保留することで、未確定ベンダー形状への早すぎる抽象化を避けた。
- **隠れた前提の可視化** — Claude 固有機能が agent 経路で未行使という事実を記録し、将来の Anthropic 依存解除判断の根拠を残した。

### ネガティブ / リスク

- **恒久方式が未確定のまま残る** — 短期方針（方向1）は accepted だが、本 ADR だけでは恒久運用ルートが決まらない。→ 対策: 恒久方式は無料ルートの運用実績（数週間の実利用で 429 発生率・運用負荷・品質安定性を観測）を踏まえて判断し、方向2′ に収束する場合は新 ADR で `LlmProvider` interface を抽出して ADR-0020 方針2 を一部 supersede する。方向1 恒久化／現状維持なら本 ADR の更新のみで足りる（条件別の操作詳細は Decision §ADR-0020 / ADR-0029 の扱い の表を参照）。
- **方向1 のゲートウェイ依存** — 短期方式はプロキシという障害点・運用責務を増やす。→ 対策: 検証フェーズ限定とし、恒久化の可否は実測後に判断する。
- **無料枠そのものの制約は方式で解消しない** — Groq free tier は TPM 6,000 で Integration 単発 ~12.4K tokens が完走困難、Gemini 無料枠はプロンプトが学習利用される（§7-4）。これらは方向1/2/2′ いずれを選んでも宛先依存で残るため、恒久運用の可否は方式選定とは別に評価する。

### 中立

- **Claude 固有機能を将来使うか自体は本 ADR では判断していない** — 現状 agent 経路で thinking / citations / prompt caching / tool use を未行使のため Anthropic ネイティブ維持の必要性は低い、という前提で方式を選んだ。将来これらを使う方針に転じる場合は、この事実と本 ADR を合わせて恒久方式を再評価する。
- 方向1 採用時、`llm-client.ts` のモジュールロード時 `LLM_API_KEY` 必須検証（ADR-0020 Consequences）は、認証を要求しないゲートウェイに対してダミー値で回避する必要がある（§7-7 runbook step3 で把握済み）。
- 本 ADR は方式選定のみを扱い、ゲートウェイ実体・モデル切替手順・疎通確認といった実装詳細は `dogfooding-log.md` §7-7 runbook に委ねる。
