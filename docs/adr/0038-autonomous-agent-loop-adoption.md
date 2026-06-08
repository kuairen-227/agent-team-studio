# 0038. 自律エージェントループ（Planner / Generator / Evaluator）の採否と段階導入方針

## Status

accepted

- 作成日: 2026-06-08
- 関連: [ADR-0007](./0007-ai-driven-dev-architecture.md)（前提：品質保証 3 層）, [ADR-0011](./0011-role-based-agent-architecture.md)（前提：ロールベースエージェントは別系統）, [ADR-0024](./0024-playwright-mcp-for-ai-verification.md)（前提：Playwright MCP）, [ADR-0037](./0037-ai-execution-sandbox-policy.md)（前提：自律実行の安全網）, Issue #269（親トラッカ）, Issue #270（本 ADR の調査）, Issue #225（磨き上げ軸・見送り候補）

## Context

`docs/guides/ai-driven-development.md` で「今後の計画」の主役に据えた **Plan/Verify 自律エージェントループ** を、本リポジトリへ取り込むかを判断する段階に来た（#269 / #270）。Anthropic の長時間稼働アプリ向け 3 エージェントハーネス（Planner / Generator / Evaluator）の精読と本リポジトリ適用設計は [long-running-app-harness.md](../guides/long-running-app-harness.md) にまとめた。

このループは既存のロールベースエージェント（po / pm / architect / qa / designer、[ADR-0011](./0011-role-based-agent-architecture.md)）とは **別系統** で、実装そのものを自律駆動する。記事の最大の知見は「自己評価は信頼できないため、生成（Generator）と評価（Evaluator）を別エージェントに分離する」こと。記事のハーネスは既存ツールの寄せ集めではなく、**専用エージェント（dedicated personas）を Claude Agent SDK 上に新規構築**したもの。本リポジトリの既存資産（`write-*-doc` / `implement-feature` / `qa` + Playwright MCP）は人手駆動・人手レビュー視点で意図が異なるため、これらの流用を前提にせず **best practice に沿って purpose-built で設計する**（既存資産は再利用を強制する制約ではなく、ベストプラクティスに合う部品のみ流用する）。

重要な前提として、記事のハーネスは V1（Opus 4.5・3 エージェント + スプリント）から V2（Opus 4.6・**スプリント撤廃**、Evaluator は最後の単一パス）へ進化している。教訓は「**ハーネスの各部品はモデルが単独でできないことの仮定であり、モデル改善で陳腐化する。最も単純な解から始め、必要なときだけ複雑さを足す**」。したがって本リポジトリでも、**3 エージェントの分離（Planner / Generator / Evaluator）は普遍的に効く中核**として全採用する一方、**スプリント機構・per-sprint 契約は必須でないモデル能力依存の足場**として、必要時のみ足す位置づけとする。Evaluator も固定の yes/no ゲートではなく、タスクがモデル単独能力を超えるときにコストに見合う。

コストは V1 フルで $200/run、V2 で $124.70/run（いずれも数時間規模、単独実行の約 20 倍超）。中断・無限ループ抑止・人間チェックポイントは記事に明示機構がなく、本リポジトリ側で補う必要がある。安全網（egress firewall）は [ADR-0037](./0037-ai-execution-sandbox-policy.md) で先行整備済み。

決めるべき論点は 3 つ:

1. 自律ループを **採用するか**、するならどの範囲・順序で導入するか
2. エージェントの **作り方**（既存資産の流用 vs purpose-built）
3. ループの **オーケストレーション手段**（自前実装 vs Claude Agent SDK）

なお実装そのものは #270 のスコープ外であり、本 ADR は方針（採否と段階導入）を定める。

## Considered Alternatives

### 論点 1: 採否と導入範囲

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 見送り継続（人手駆動の疑似ループのまま） | 却下 — `process-issue` → `implement-feature` → `review` の直列は機能するが、自己評価分離・契約・しきい値の機械化という記事の中核価値を取りこぼす。両輪のもう片方（自律軸）が空白のまま |
| B | Evaluator のみ自動化（生成は人手） | 部分採用 — 段階導入の **Phase 1** として最小コストで最大の知見を取る。ただしここで止めると Generator/Planner の自律化価値が未回収 |
| C | Planner / Generator / Evaluator の 3 者を段階導入で全採用 | **採用** — 3 者の分離が普遍的に効く中核。リスクの低い順（Evaluator → Generator → Planner + 統合）に積み、各 Phase で Go/No-Go を測りながらフル自律ループへ到達する。スプリント機構は足場として必要時のみ追加（「最も単純な解から始める」） |

### 論点 2: エージェントの作り方

| # | 選択肢 | 判定 |
| - | --- | --- |
| D | 既存のロールベースエージェント / 人手スキルを流用（`qa` を Evaluator に、`implement-feature` を Generator に転用） | 却下 — `qa` は human-in-the-loop のレビュー視点、`implement-feature` は人手手順で、自律ループの意図（較正ルーブリック + hard threshold + 自走検証 / 自律スプリント）と異なる。流用は役割を二重化し、記事が重視する purpose-built の作り込み（懐疑的 Evaluator 等）を阻害する |
| E | purpose-built（専用エージェント/プロンプトを新規構築。ベストプラクティスに合うツール・基盤・規律のみ流用） | **採用** — 記事と同じく専用 personas を作る。Playwright MCP・Claude Agent SDK・ファイルハンドオフ基盤・安全網・型駆動/軽量 TDD の規律は部品として流用する |

### 論点 3: オーケストレーション手段

| # | 選択肢 | 判定 |
| - | --- | --- |
| F | 自前実装（Claude Code のスキル/サブエージェント + ファイルハンドオフ） | Phase 1〜2 で採用 — 追加依存なく検証できる |
| G | Claude Agent SDK（#225 C 群「Managed Agents SDK」） | Phase 3 で再評価 — **記事のハーネスは Agent SDK 上に構築**され、自動コンパクション・オーケストレーションを担う実証パス。自前実装の限界が見えた段階で比較する |

## Decision

1. **Planner / Generator / Evaluator の 3 エージェント自律ループを、段階導入で全採用する方針とする**（論点 1-C）。**エージェントは purpose-built で新規構築し（論点 2-E）**、既存資産はベストプラクティスに合う部品（Playwright MCP / Claude Agent SDK / ファイルハンドオフ基盤 / 安全網 / 型駆動・軽量 TDD の規律）のみ流用する。実装は本 ADR のスコープ外で、各 Phase は個別 Issue として後続で起票する。段階は [long-running-app-harness.md §3](../guides/long-running-app-harness.md) に従う:

   - **Phase 1**: 専用 Evaluator エージェントを新規構築（較正ルーブリック + hard threshold + Playwright 自走。まずは最後の単一パス採点）。人手レビュー（`review` / `qa`）はフォールバックとして併存
   - **Phase 2**: 専用 Generator エージェントで Planner 仕様を自律実装（型駆動 / 軽量 TDD を規律として参照、反復/コスト上限付き）。スプリント契約 + per-sprint 採点は、タスクがモデル単独能力を超える場合のみ追加する足場
   - **Phase 3**: 専用 Planner（プロンプト/Issue → 仕様）+ 3 者ループ統括

2. **導入の前提条件（ガードレール）を必須とする**。各 Phase はこれらを満たさない限り次へ進めない:

   | ガードレール | 内容 |
   | --- | --- |
   | 合格しきい値 | Evaluator の基準を採点可能な形に較正し、1 つでも下回れば失敗とする（記事準拠） |
   | 反復/コスト上限 | 最大スプリント数・最大反復回数・トークン/時間バジェットを機械的に課す |
   | 中断機構 | AbortController / `AbortSignal.any` による実行中断、`permissions.deny` による tool 遮断 |
   | 人間チェックポイント | スプリント契約合意・PR 作成・ADR 要否の各点で human-in-the-loop |
   | 安全網 | [ADR-0037](./0037-ai-execution-sandbox-policy.md) の egress firewall（exfiltration 防止）を前提とする |

3. **オーケストレーション手段は Phase で確定する**。Phase 1〜2 は自前実装（論点 3-F）、Phase 3 着手時に Claude Agent SDK（論点 3-G）との比較で確定する。

4. **見送り候補（#225）を再評価する**。auto memory は構造化ファイルハンドオフを優先しつつ Phase 2 以降で再判定、Managed Agents SDK は Phase 3 で再評価する（[long-running-app-harness.md §5](../guides/long-running-app-harness.md)）。

5. **再検討契機**: Phase ごとの Go/No-Go 判断で、コスト実測・合格率・人手介入頻度が想定を外れた場合は方針を見直す。あわせて **Phase 2 でハーネス側のモデル選択（コストが偏る Generator への Sonnet 併用可否）を実測判断する**。コストはほぼ Generator に集中する（V2 実測で約 91%）一方、Generator を弱めると Evaluator の反復が増え QA 往復で相殺し得るため、合格率と総コスト（QA 込み）で採否を決める。Planner / Evaluator は判断品質・連鎖影響を優先し当面は強モデルに据え置く。ループはエージェント単位でモデル指定可能に設計する（プロダクト側のマルチベンダー方針 [ADR-0032](./0032-llm-multi-vendor-strategy.md) / [ADR-0034](./0034-llm-client-ai-sdk.md) とは別物のハーネス側選択）。

## Consequences

- 自律ループの実装は複数 Phase の後続 Issue に分割される。本 ADR は方針のみを定め、各 Phase の詳細設計・受入条件は個別 Issue で扱う。
- フル自律（Phase 3）はコストが単一エージェントの 20 倍超に達し得る。対象タスクの規模が小さい場合は Evaluator が過剰オーバーヘッドになるため、適用境界の見極めが運用上の負担として残る。
- ガードレール（しきい値・上限・中断・チェックポイント）の実装が各 Phase の前提コストとして乗る。これらは記事に明示機構がない領域で、本リポジトリ独自の設計が必要になる。
- 既存のロールベースエージェント（[ADR-0011](./0011-role-based-agent-architecture.md)）と本ループは別系統で併存する。Evaluator は `qa` を流用せず専用に作るため役割の二重化は避けられるが、専用エージェント/プロンプトの新規構築・較正（懐疑性チューニング）のコストが乗る。
- 段階導入のため、Phase 1 だけで止める判断もあり得る。その場合 Generator / Planner の自律化価値は未回収のまま残る。
- [ADR-0037](./0037-ai-execution-sandbox-policy.md) が残した fail-close / 起動ヘルスチェックの要否は、無人実行（Phase 2 以降）の設計時に顕在化し、別途判断が必要になる。
- status は accepted。3 エージェント全採用の方針を確定する。ただし各 Phase の着手可否は Phase ごとに Go/No-Go 判断（コスト実測・合格率・人手介入頻度）を経る。
