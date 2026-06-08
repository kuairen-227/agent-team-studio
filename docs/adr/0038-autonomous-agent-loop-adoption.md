# 0038. 自律エージェントループ（Planner / Generator / Evaluator）の採否と段階導入方針

## Status

proposed

- 作成日: 2026-06-08
- 関連: [ADR-0007](./0007-ai-driven-dev-architecture.md)（前提：品質保証 3 層）, [ADR-0011](./0011-role-based-agent-architecture.md)（前提：ロールベースエージェントは別系統）, [ADR-0024](./0024-playwright-mcp-for-ai-verification.md)（前提：Playwright MCP）, [ADR-0037](./0037-ai-execution-sandbox-policy.md)（前提：自律実行の安全網）, Issue #269（親トラッカ）, Issue #270（本 ADR の調査）, Issue #225（磨き上げ軸・見送り候補）

## Context

`docs/guides/ai-driven-development.md` で「今後の計画」の主役に据えた **Plan/Verify 自律エージェントループ** を、本リポジトリへ取り込むかを判断する段階に来た（#269 / #270）。Anthropic の長時間稼働アプリ向け 3 エージェントハーネス（Planner / Generator / Evaluator）の精読と本リポジトリ適用設計は [long-running-app-harness.md](../guides/long-running-app-harness.md) にまとめた。

このループは既存のロールベースエージェント（po / pm / architect / qa / designer、[ADR-0011](./0011-role-based-agent-architecture.md)）とは **別系統** で、実装そのものを自律駆動する。記事の最大の知見は「自己評価は信頼できないため、生成（Generator）と評価（Evaluator）を別エージェントに分離する」こと。本リポジトリでは Planner / Generator / Evaluator に対応する素材（`write-*-doc` / `implement-feature` / `qa` + Playwright MCP）が既に**人手駆動**で揃っており、自律ループ化の最短距離にある。記事のハーネスは **Claude Agent SDK** 上に構築されている。

重要な前提として、記事のハーネスは V1（Opus 4.5・3 エージェント + スプリント）から V2（Opus 4.6・**スプリント撤廃**、Evaluator は最後の単一パス）へ進化している。教訓は「**ハーネスの各部品はモデルが単独でできないことの仮定であり、モデル改善で陳腐化する。最も単純な解から始め、必要なときだけ複雑さを足す**」。したがって本リポジトリでも、**3 エージェントの分離（Planner / Generator / Evaluator）は普遍的に効く中核**として全採用する一方、**スプリント機構・per-sprint 契約は必須でないモデル能力依存の足場**として、必要時のみ足す位置づけとする。Evaluator も固定の yes/no ゲートではなく、タスクがモデル単独能力を超えるときにコストに見合う。

コストは V1 フルで $200/run、V2 で $124.70/run（いずれも数時間規模、単独実行の約 20 倍超）。中断・無限ループ抑止・人間チェックポイントは記事に明示機構がなく、本リポジトリ側で補う必要がある。安全網（egress firewall）は [ADR-0037](./0037-ai-execution-sandbox-policy.md) で先行整備済み。

決めるべき論点は 2 つ:

1. 自律ループを **採用するか**、するならどの範囲・順序で導入するか
2. ループの **オーケストレーション手段**（自前実装 vs Managed Agents SDK）

なお実装そのものは #270 のスコープ外であり、本 ADR は方針（採否と段階導入）を定める。

## Considered Alternatives

### 論点 1: 採否と導入範囲

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 見送り継続（人手駆動の疑似ループのまま） | 却下 — `process-issue` → `implement-feature` → `review` の直列は機能するが、自己評価分離・契約・しきい値の機械化という記事の中核価値を取りこぼす。両輪のもう片方（自律軸）が空白のまま |
| B | Evaluator のみ自動化（生成は人手） | 部分採用 — 段階導入の **Phase 1** として最小コストで最大の知見を取る。ただしここで止めると Generator/Planner の自律化価値が未回収 |
| C | Planner / Generator / Evaluator の 3 者を段階導入で全採用 | **採用（proposed）** — 3 者の分離が普遍的に効く中核。リスクの低い順（Evaluator → Generator → Planner + 統合）に積み、各 Phase で Go/No-Go を測りながらフル自律ループへ到達する。スプリント機構は足場として必要時のみ追加（「最も単純な解から始める」） |

### 論点 2: オーケストレーション手段

| # | 選択肢 | 判定 |
| - | --- | --- |
| D | 自前実装（Claude Code のスキル/サブエージェント + ファイルハンドオフ） | Phase 1〜2 で採用 — 既存スキル/エージェントの範囲で検証でき、追加依存がない |
| E | Claude Agent SDK（#225 C 群「Managed Agents SDK」） | Phase 3 で再評価 — **記事のハーネスは Agent SDK 上に構築**され、自動コンパクション・オーケストレーションを担う実証パス。自前実装の限界が見えた段階で比較する |

## Decision

1. **Planner / Generator / Evaluator の 3 エージェント自律ループを、段階導入で全採用する方針とする**（論点 1-C）。実装は本 ADR のスコープ外で、各 Phase は個別 Issue として後続で起票する。段階は [long-running-app-harness.md §3](../guides/long-running-app-harness.md) に従う:

   - **Phase 1**: Evaluator 自動化（`qa` + Playwright を `review` から自律呼び出し、合格しきい値を機械化。まずは最後の単一パス採点）
   - **Phase 2**: Generator 自律化（`implement-feature` を Planner 仕様に対し反復/コスト上限付きで自律実行。スプリント契約 + per-sprint 採点は、タスクがモデル単独能力を超える場合のみ追加する足場）
   - **Phase 3**: Planner 自動展開（プロンプト/Issue → 仕様）+ 3 者ループ統括

2. **導入の前提条件（ガードレール）を必須とする**。各 Phase はこれらを満たさない限り次へ進めない:

   | ガードレール | 内容 |
   | --- | --- |
   | 合格しきい値 | Evaluator の基準を採点可能な形に較正し、1 つでも下回れば失敗とする（記事準拠） |
   | 反復/コスト上限 | 最大スプリント数・最大反復回数・トークン/時間バジェットを機械的に課す |
   | 中断機構 | AbortController / `AbortSignal.any` による実行中断、`permissions.deny` による tool 遮断 |
   | 人間チェックポイント | スプリント契約合意・PR 作成・ADR 要否の各点で human-in-the-loop |
   | 安全網 | [ADR-0037](./0037-ai-execution-sandbox-policy.md) の egress firewall（exfiltration 防止）を前提とする |

3. **オーケストレーション手段は Phase で確定する**。Phase 1〜2 は自前実装（論点 2-D）、Phase 3 着手時に Managed Agents SDK（論点 2-E）との比較で確定する。

4. **見送り候補（#225）を再評価する**。auto memory は構造化ファイルハンドオフを優先しつつ Phase 2 以降で再判定、Managed Agents SDK は Phase 3 で再評価する（[long-running-app-harness.md §5](../guides/long-running-app-harness.md)）。

5. **再検討契機**: Phase ごとの Go/No-Go 判断で、コスト実測・合格率・人手介入頻度が想定を外れた場合は方針を見直す。

## Consequences

- 自律ループの実装は複数 Phase の後続 Issue に分割される。本 ADR は方針のみを定め、各 Phase の詳細設計・受入条件は個別 Issue で扱う。
- フル自律（Phase 3）はコストが単一エージェントの 20 倍超に達し得る。対象タスクの規模が小さい場合は Evaluator が過剰オーバーヘッドになるため、適用境界の見極めが運用上の負担として残る。
- ガードレール（しきい値・上限・中断・チェックポイント）の実装が各 Phase の前提コストとして乗る。これらは記事に明示機構がない領域で、本リポジトリ独自の設計が必要になる。
- 既存のロールベースエージェント（[ADR-0011](./0011-role-based-agent-architecture.md)）と本ループは別系統で併存する。`qa` エージェントは Evaluator の素材として再利用され、役割の重なりを運用で整理する必要がある。
- 段階導入のため、Phase 1 だけで止める判断もあり得る。その場合 Generator / Planner の自律化価値は未回収のまま残る。
- [ADR-0037](./0037-ai-execution-sandbox-policy.md) が残した fail-close / 起動ヘルスチェックの要否は、無人実行（Phase 2 以降）の設計時に顕在化し、別途判断が必要になる。
- status は proposed。各 Phase 着手の可否はユーザー判断を経て確定する。
