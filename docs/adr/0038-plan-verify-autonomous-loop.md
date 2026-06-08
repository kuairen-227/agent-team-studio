# 0038. Plan/Verify 自律エージェントループの採否と段階導入方針

## Status

proposed

- 作成日: 2026-06-08
- 関連: [ADR-0007](./0007-ai-driven-dev-architecture.md)（前提：ハイブリッドエージェント方式・品質保証 3 層）, [ADR-0011](./0011-role-based-agent-architecture.md)（前提：ロールベースエージェント）, [ADR-0024](./0024-playwright-mcp-for-ai-verification.md)（前提：Playwright MCP）, [ADR-0037](./0037-ai-execution-sandbox-policy.md)（前提：自律実行の安全網）, Issue #270, Issue #269（親トラッカ）
- 調査根拠: [docs/design/technotes/plan-verify-loop-spike.md](../design/technotes/plan-verify-loop-spike.md)

> 本 ADR は **ドラフト（proposed）**。方向性と段階導入の枠を定めるもので、各段階の実装着手は別途 Issue 化し、その時点の費用対効果を見て accept / 着手を判断する。

## Context

Anthropic が長時間稼働アプリ開発向けに示した 3 エージェントハーネス（Planner / Generator / Evaluator）を、本リポジトリの開発サイクルへ取り込む構想がある（`docs/guides/ai-driven-development.md`「今後の計画」節）。これは既存のロールベースエージェント（po / pm / architect / qa / designer、[ADR-0011](./0011-role-based-agent-architecture.md)）とは**別系統**で、実装そのものを自律駆動するループを担う。

公式リファレンス実装 [`anthropics/cwc-long-running-agents`](https://github.com/anthropics/cwc-long-running-agents) は、このパターンを **Claude Code config（hooks / subagents）** として提示しており、本リポジトリの `.claude/` 構成・Playwright MCP・`permissions`・egress firewall（[ADR-0037](./0037-ai-execution-sandbox-policy.md)）にほぼ 1:1 で写像できる（[調査ノート](../design/technotes/plan-verify-loop-spike.md)）。自律実行の安全網は #271（ADR-0037）で先行整備済みであり、自律ループの採否と進め方をこのタイミングで枠決めする必要がある。

決めるべき論点:

1. このループを**採用するか / 見送るか**
2. 採用する場合、**どの粒度・順序で段階導入するか**（コスト・暴走・人間チェックポイント喪失のリスクと、[principles §1 ユーザー判断優先](../principles/README.md)との緊張をどう扱うか）

## Considered Alternatives

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | **見送る（defer）** | 却下 — 現状の implement-feature + review + qa の人手駆動でも回るが、リファレンスが既存資産にほぼ 1:1 で写像でき、安全網も整備済みのため、方向性を保留する積極的理由がない。少なくとも信頼性向上が大きい Verifier 先行は試す価値がある |
| B | **フル 3 エージェント自律ループを近接で本格導入** | 却下 — 無人ループ（plan→build→test→repair）はコスト・暴走・人間チェックポイント喪失のリスクが一度に上がる。MVP 整合・節度（[principles §3/§4](../principles/README.md)）に反し、学習プロジェクトとしてユーザー判断機会も失う。リファレンス自身も「turnkey ではなく材料を cherry-pick せよ」とする |
| C | **方向性として採用し、Verifier 先行で段階導入** | **採用** — 安全網（段階 0）は整備済み。価値が高く・リスクが低く・既存資産（qa / Playwright MCP / hooks）の再利用度が高い Verifier から始める。各段階で費用対効果を確認しながら進め、無人化は明示合意してから |

## Decision

1. **方向性として採用**する。ただし**実装着手は v1.1 スコープ外**とし、段階導入の枠のみ本 ADR で定める。各段階の着手は別 Issue 化し、その時点で判断する。

2. **段階導入の枠**（詳細は [調査ノート §3](../design/technotes/plan-verify-loop-spike.md)）:

   | 段階 | スコープ | 主に再利用する資産 |
   | --- | --- | --- |
   | 0（済） | 安全網（egress firewall / permissions / DevContainer） | [ADR-0037](./0037-ai-execution-sandbox-policy.md) |
   | **1（起点）** | fresh-context Evaluator サブエージェントで `implement-feature` 完了物を懐疑的に PASS/NEEDS_WORK 判定（人間がループ駆動＝半自律） | qa エージェント / Playwright MCP / review スキル |
   | 2 | Default-FAIL contract（受入基準ファイル + `PreToolUse` ゲート）で証拠なし成功宣言を機械的に防ぐ | hooks 機構 / permissions |
   | 3 | `PROGRESS.md` ハンドオフ + checkpoint commit でセッション跨ぎ継続 | git / CLAUDE.md 規約 |
   | 4 | `/goal` or wrapper で無人ループ化。kill-switch / steer を併設 | 上記すべて |

3. **Verifier 先行（段階 1）を起点**とする。段階 1 だけで「自己採点の排除」という単体エージェント比の主要な信頼性向上が得られ、追加コストが限定的なため。段階 4（無人ループ）への移行は、段階 1〜3 の費用対効果を確認し、ユーザーの明示合意を得てから判断する。

4. **人間チェックポイントの保持**: 段階 1〜3 は人間がループを駆動する。無人化（段階 4）は [principles §1 ユーザー判断優先](../principles/README.md)との緊張が最大化するため、ADR を更新（または後続 ADR）して合意してから着手する。

5. **再検討契機**:
   - 段階 1 を Issue 化・実施し、費用対効果が見えた時点で段階 2 以降と本 ADR の accept 化を判断する。
   - 無人ループ（段階 4）着手時に、firewall の fail-close / 起動ヘルスチェック（[ADR-0037](./0037-ai-execution-sandbox-policy.md) 申し送り）と、auto memory / Agent SDK 移行（#225 B/C 群）の要否を再評価する。

## Consequences

- 方向性が定まり、磨き上げ軸（#225）に偏っていた計画に自律ループ軸が加わる（#269 の両輪が揃う）。
- 段階導入を Claude Code（hooks / subagents）上で進めるため、当面 Agent SDK 移行は不要。無人ループ（段階 4）まで進めて初めて SDK 移行の検討が必要になる。
- ドラフト（proposed）のままでは「決定済み」として参照できない。段階 1 の Issue 化・実施で実態が伴った段階で accept 化する想定。
- 各段階のフック・サブエージェント追加は `.claude/` の構成を増やす。[principles §3 節度](../principles/README.md)に照らし、段階ごとに費用対効果を確認してから追加する（一括導入しない）。
- 無人化（段階 4）はコスト・暴走・人間チェックポイント喪失のリスクを伴う。安全網（ADR-0037）と本 ADR の段階ゲートで多重に抑制するが、ゼロにはならない。
- `docs/guides/ai-driven-development.md`「今後の計画」節から本 ADR と調査ノートへ参照を張る（インベントリの「Plan/Verify ループ＝計画」は方針が定まったことに合わせて記述を補足）。
