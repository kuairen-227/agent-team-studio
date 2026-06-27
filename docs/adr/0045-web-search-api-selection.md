# 0045. Web 検索 API の選定（Tavily 採用 / 出典グラウンディング方式）

## Status

accepted

- 作成日: 2026-06-27
- 関連: [ADR-0044](./0044-v2-scope-definition.md)（前提: N2 を含む v2.0 軸1 のスコープ）, [ADR-0029](./0029-free-llm-api-selection.md)（同型: 無料枠運用方針 / クレカ不要を重視）, [ADR-0034](./0034-llm-client-ai-sdk.md) / [ADR-0032](./0032-llm-multi-vendor-strategy.md)（前提: 無料主力は Groq・マルチベンダー方式）, [ADR-0041](./0041-egress-firewall-nftables-ipv6.md) / [ADR-0037](./0037-ai-execution-sandbox-policy.md)（前提: egress allowlist の追加方針）, [ADR-0039](./0039-secret-read-guard.md)（前提: secret 管理・読取ガード）, Issue #322, Issue #320（親トラッカ）, Issue #323（後続: N2 実装）

## Context

N2（Web 検索連携）は、MVP 受け入れ検証で残った**基準3 CONDITIONAL** を PASS 化するための機能である（[ADR-0044](./0044-v2-scope-definition.md) 軸1）。引き金は「調査結果の各観点セルに**出典 URL が欠如**している」「入力参考情報のファクトチェック未実装」の 2 点（validation-summary §2 / §4）。

現状、プロダクトのエージェント（`packages/agent-core`）は Vercel AI SDK Core の `streamText` で LLM API を呼ぶだけで（[ADR-0034](./0034-llm-client-ai-sdk.md)）、**Web を引く経路が一切配線されていない**。`SOURCE_ORIGINS` に `web_search` origin 型は用意済みだが（#226）、実際の検索基盤がないため出典 URL を裏付けなしに出すしかなく、これが基準3 CONDITIONAL の直接原因である。N2 は「本物の Web グラウンディングを足し、検証可能な出典 URL を付与する」ための機能であり、その前段として外部 Web 検索の**到達方式と採用 API** を確定する必要がある。

外部サービス採用は社内クラウド承認制・セキュリティレビューの制約下にある（[ADR-0002](./0002-project-scenario.md) シナリオ）。本 ADR は [ADR-0029](./0029-free-llm-api-selection.md)（無料 LLM 選定）と同型で、無料枠運用方針・egress・secret 管理の制約適合まで含めて記録する。

## Considered Alternatives

### 論点 1: Web グラウンディングの到達方式

| # | 選択肢 | 仕組み | 判定 |
| - | --- | --- | --- |
| A | プロバイダ内蔵 Web 検索 | LLM がサーバ側で検索し citation 付きで返す（Anthropic `web_search` ツール等） | 却下 — **無料常用ルートの Groq Llama 3.3 70B には内蔵検索が無い**（ADR-0029 再決定 / ADR-0034）。検索が Anthropic 等の有料/対応 provider 利用時のみ機能し、「無料・マルチベンダー」前提（ADR-0029）を崩す。検索ごとの従量課金が上乗せされ、クエリ/ランキングに介入できず provider ごとに citation 形式が異なるため基準3 の合否を決定論的にテストしにくい |
| B | **専用 Web 検索 API（アプリ層に検索境界）** | アプリが検索 API を呼び、結果＋出典 URL を LLM 文脈へ注入（RAG 方式） | **採用** — どの LLM（無料 Groq 含む）でも同一の検索結果・出典フォーマットで動き、ベンダー非依存。クエリ/キャッシュ/レート制御/許可ドメイン適用をアプリが握れ、出典 URL を明示でき基準3 に直結。検索境界をモック化でき再現性のあるテストが可能（ADR-0036 Testing Trophy と整合） |
| C | ハイブリッド（A＋B 二段構え） | Anthropic 利用時は内蔵、無料 Groq 等では専用 API | 却下（再検討契機付き） — 柔軟だが provider 別に到達経路を二重に抱え、テスト面・ADR の複雑度が倍増。学習スコープには過剰（YAGNI）。明確な forcing function（内蔵検索の品質優位が実測で支配的になる等）が現れた時点で再評価する |

> 補足: B はモデルが内蔵検索を持つ provider（Anthropic / Gemini 等）を使う場合も無駄にならない。内蔵が品質上限で勝るのは「単一の有料 provider にロックインして品質最優先」のケースに限られる。N2 の目的は出典・ファクトの信頼性そのものであり、検索境界をアプリが持つ方が評価対象の挙動を手放さず、むしろ堅牢。内蔵一本がベストになるのは無料 Groq ルートを捨てて有料 provider に commit した世界線で、それは ADR-0029 を覆す別判断になる。

### 論点 2: 採用 Web 検索 API の候補比較（2026-06 時点）

| # | API | 無料枠 | クレカ | 出典 URL | カバレッジ / 設計 | 利用規約 | egress ドメイン | 判定 |
| - | --- | --- | --- | --- | --- | --- | --- | --- |
| A | **Tavily** | 1,000 credits/月（繰越なし） | ❌ 不要 | ✅ LLM エージェント向けに出典付きで返す | 検索＋抽出を LLM 用途に最適化 | クリーン（スクレイピング非依存） | `api.tavily.com` | **採用** |
| B | Exa | 1,000 検索/月＋$10 初期 credit | ❌ 不要 | ✅ neural search＋本文抽出 | semantic/neural（発見的探索向き） | AI 向けに明確 | `api.exa.ai` | 次点 — 発見的探索に強いが、競合の精緻なキーワード検索への特化度は Tavily より低い |
| C | Brave Search API | **2026-02 に無料枠廃止** → $5 従量 credit＋帰属表示必須 | ✅ 必要 | ✅ 独立インデックス | プライバシー重視・独立索引 | 明確（帰属表示条件あり） | `api.search.brave.com` | 却下 — クレカ必須化で「クレカ不要の無料枠」方針（ADR-0029 同型）と不整合 |
| D | Serper.dev / SerpApi | 2,500 一回 / 100 月 | ❌ | ✅ | Google SERP スクレイピング | **グレー**（Google ToS 抵触懸念） | `google.serper.dev` 等 | 却下 — スクレイピング依存で利用規約リスク。承認制・セキュリティレビュー制約と相性が悪い |
| E | Google Custom Search JSON | 100 クエリ/日 | 課金プロジェクト要 | ✅ | CSE 単位に制約 | CSE 制約 | `www.googleapis.com` | 却下 — 100/日 は調査並列実行に不足。CSE 設定の制約と課金プロジェクト前提 |
| F | Bing Web Search（Azure） | — | — | ✅ | — | — | — | 却下 — 提供終了が進行中（2025-08 retirement 告知） |
| G | DuckDuckGo Instant Answer | 非公式・無制限だがスニペットのみ | ❌ | △ 部分的 | 完全な SERP を返さない | 非公式 | `api.duckduckgo.com` | 却下 — 非公式・スニペット限定で出典 URL リッチな SERP を得られない |
| H | SearXNG（self-host） | 無料・自前運用 | — | ✅ | 70+ エンジンのメタ検索 | OSS | self-host | 却下 — self-host の運用コストが学習スコープ過大（ADR-0039 が Infisical self-host を却下したのと同型） |

**出典**:

- Tavily 無料枠: [Credits & Pricing — Tavily Docs](https://docs.tavily.com/documentation/api-credits)（1,000 credits/月・クレカ不要）
- Brave 無料枠廃止: [Brave Search — API Pricing](https://api-dashboard.search.brave.com/documentation/pricing)（2026-02 メータ課金移行・帰属表示条件）
- Exa 無料枠: [API Pricing | Exa](https://exa.ai/pricing)（1,000 検索/月＋初期 credit・クレカ不要）

## Decision

1. **到達方式は B（専用 Web 検索 API・アプリ層に検索境界）を採用する（論点 1-B）。** プロバイダ内蔵検索（A）は無料主力 Groq で機能せず ADR-0029 の無料・マルチベンダー方針を崩すため却下する。ハイブリッド（C）は学習スコープに過剰として見送り、forcing function 出現時に再評価する。

2. **採用 API は Tavily とする（論点 2-A）。** 1,000 credits/月・クレカ不要の無料枠（ADR-0029 が重視した方針と整合）、LLM エージェント向けに出典 URL を返す設計（基準3 に直結）、Google スクレイピング系の ToS グレーゾーンを回避（承認制・セキュリティレビュー制約と整合）、単一安定ドメインで egress 追加が容易、という総合判断による。Exa を次点とし、Tavily の無料枠/品質が将来不足した場合の第一代替とする。

3. **egress allowlist に `api.tavily.com` を追加する。** [ADR-0041](./0041-egress-firewall-nftables-ipv6.md) の許可ドメイン追加方針（`.devcontainer/init-firewall.sh` の `for domain in` ループへ追記し、`docs/guides/devcontainer.md` の許可ドメイン表を更新）に従う。最小限の原則（ADR-0037）に沿い、追加は本 API の単一ドメインに限定する。Claude Code on the web（リモート実行環境）は別途 network policy が egress を統治するため、本追加は**ローカル DevContainer** の egress を補完する位置づけ（ADR-0041 と不変）。具体的な firewall 設定変更は後続 #323 の実装で行い、本 ADR は方針のみを定める。

4. **API キーは既存の secret 管理方式に載せる。** `TAVILY_API_KEY` をアプリ env（`apps/api/.env`）に置き、[ADR-0039](./0039-secret-read-guard.md) の保護層（Read deny の `**/.env` 系 glob ＋ PreToolUse(Bash) ガードフックの `.env` トークン検出 ＋ `.gitignore` ＋ secretlint ＋ egress firewall）でカバーする。新規の deny エントリ追加は不要（パスベースの既存 glob が一致する）。`.env.example` に鍵名のみ（値は空）を追記し、実値はローカルにのみ置く。

5. **フォールバック / レート制限時の挙動方針を定める。** 無料枠（1,000 credits/月・繰越なし）超過や 429 / タイムアウト時は、検索を失敗として握りつぶさず**当該観点の出典を「取得不可」として明示**し、エージェントが**捏造 URL で埋めない**ことを最優先とする（基準3 の主旨は検証可能性であり、偽の出典は基準3 を満たさない）。リトライ方針（指数バックオフ・上限）と「出典取得不可」を下流に伝える型・表示の具体は後続 #323 の受入条件で確定する。Exa への切替（次点）は無料枠/品質が継続的に不足した場合の運用判断とし、その時点で本 ADR を追記または supersede する。

## Consequences

### ポジティブ

- 無料 LLM（Groq）のまま全モデルで同一品質の Web 検索が可能になり、基準3 の「出典 URL 付与」を決定論的に満たす道筋ができる。
- 検索境界がアプリ層に集約され、クエリ/キャッシュ/レート制御/許可ドメイン適用・テストのモック化をアプリが握れる（ADR-0036 Testing Trophy と整合）。
- egress 追加が単一ドメイン（`api.tavily.com`）で済み、ADR-0037「allowlist 最小限」を維持できる。
- secret は既存の多層保護（ADR-0039）に新規 deny 追加なしで載る。

### ネガティブ / リスク

- **無料枠の制約**: Tavily は 1,000 credits/月・繰越なし。調査エージェントの並列実行で消費が嵩むと月内に枯渇し得る。→ 緩和: クエリのキャッシュ/重複排除で消費を抑制し、枯渇時は「出典取得不可」を明示（捏造禁止）。継続的に不足する場合は次点 Exa へ切替（本 ADR 追記）。
- **外部サービス継続性への依存**: 検索品質・無料枠・ToS は提供元都合で変動し得る（Brave の無料枠廃止が実例）。→ 緩和: 検索境界をアプリ層の port として薄く保ち、Exa 等への差し替えを局所化する。
- **ファクトチェック（基準3 のもう一方）は本 ADR の範囲外**: 出典 URL の付与（N2）はカバーするが、入力参考情報の事実矛盾検出（V2 / #324）は別機能。基準3 PASS には両者が要る（ADR-0044 軸1）。

### 中立

- 本 ADR は**方式と採用 API の選定**までを担い、egress 設定変更・secret 配線・リトライ/型の実装・計測シナリオは後続 #323（N2 実装）の受入条件に委ねる。基準3 の合否閾値の具体化も #323 / #324 に課される（ADR-0044）。
- プロバイダ内蔵検索（論点 1-A）への将来移行は、無料主力を有料 provider に切り替える判断（ADR-0029 の supersede）とセットでない限り成立しない。ハイブリッド（1-C）採用の forcing function が現れた場合は本 ADR を再評価する。
