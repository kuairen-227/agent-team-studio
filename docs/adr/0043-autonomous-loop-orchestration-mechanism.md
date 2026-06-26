# 0043. 自律ループのオーケストレーション手段の確定（自前 = Claude Code サブエージェント + ファイルハンドオフ）

## Status

accepted

- 作成日: 2026-06-26
- 関連: [ADR-0038](./0038-autonomous-agent-loop-adoption.md)（前提：段階導入方針・本 ADR は論点 3 を確定）, [ADR-0011](./0011-role-based-agent-architecture.md)（前提：ロールベースエージェントは別系統）, [ADR-0024](./0024-playwright-mcp-for-ai-verification.md)（前提：Playwright MCP）, [ADR-0037](./0037-ai-execution-sandbox-policy.md) / [ADR-0041](./0041-egress-firewall-nftables-ipv6.md)（前提：安全網）, Issue #291（Planner + 3 者統合）, Issue #270（調査）, Issue #269（親トラッカ）, Issue #225（見送り候補）

## Context

[ADR-0038](./0038-autonomous-agent-loop-adoption.md) は自律エージェントループ（Planner / Generator / Evaluator）を段階導入で全採用する方針を定めたが、**論点 3「ループのオーケストレーション手段（自前実装 vs Claude Agent SDK）」は段階導入の最終段（Planner + 3 者統合）で確定する**として未決のまま残した（Decision §3）。Evaluator 導入（#289）/ Generator 自律化（#290）はいずれも**自前**（Claude Code のサブエージェント + ファイルハンドオフ）で成立しており、専用 Planner と 3 者ループ統括（#291）に到達した今、手段を確定する。

本ループの性質を確認する:

- **逐次**: 計画 → 実装 → 検証 → 修復の各段は前段の出力に依存する（並列ではない）。Generator と Evaluator は同時に走らせない（[long-running-app-harness.md §8](../guides/long-running-app-harness.md) の逐次実行モデル）。
- **ファイルハンドオフ**: エージェント間通信はファイル経由（一方が書き、他方が読む）。記事のハーネスもこの方式。
- **人手監督下・小規模**: 本リポジトリの Issue は記事の対象（数時間規模の新規生成）より小さく、3 者統合後も仕様合意・PR を人間チェックポイントとして挟む監督下運用である。

確定の判断材料として、Anthropic 公式ガイダンス、記事のハーネス、および一般に普及したマルチエージェント / ループ駆動のベストプラクティス（Ralph ループを含む）を調査した（#291 で実施）。要点:

- **Claude Code 公式（subagents vs agent teams）**: サブエージェントは「逐次・結果重視・依存の多い作業」に最適で、main エージェントが統括し、トークンコストが低い。Agent Teams は「並列・独立探索」向けで**実験的（既定では無効）**・高コスト。逐次・依存の多い作業では単一セッション + サブエージェントが有効、と明記されている。本ループは逐次ファイルハンドオフであり、サブエージェント像に一致する。
- **記事のハーネス**: Claude Agent SDK を採用しているが、オーケストレーション自体は "straightforward"。SDK の load-bearing な価値は**数時間単一セッションの自動コンパクション**（モデル能力依存の足場で、Opus 4.6 で context anxiety が解消されたことに紐づく）であり、本リポジトリの監督下・小規模運用では未到達。
- **Ralph ループ**（Geoffrey Huntley が広めた極小パターン）: 単一エージェントを `while` ループで回し、**反復ごとにコンテキストをリセット**し、状態を git / ファイルへ外出しし、**検証を exit gate** にする。SDK もフレームワークも使わない最小構成で人気がある。ただし**生成と評価を分離しない単一エージェントのブルートフォース**であり、記事の中核知見（生成と評価を別エージェントに分離）および [ADR-0038](./0038-autonomous-agent-loop-adoption.md) が確定した「分離は普遍的に効く中核」と方向が逆。一方、Ralph の効きどころ（反復ごとのフレッシュコンテキスト・外部ファイル状態・検証 exit gate）は、後述のとおり自前のサブエージェント方式が既に内包する。
- **一般論**: minimal な agent SDK は「プロセス再起動を跨いで数時間ポーズ・再開する durable execution」を担う設計ではなく、それが要件化するなら Temporal 等の実行基盤と組む。本ループは人手監督下で、現時点でこの durability 層を必要としない。

記事の最重要教訓「**最も単純な解から始め、必要なときだけ複雑さを足す**」（[ADR-0038](./0038-autonomous-agent-loop-adoption.md) / 記事）に照らし、未到達の能力に合わせて重い基盤を先取りしない。

## Considered Alternatives

| # | 選択肢 | 判定 |
| - | --- | --- |
| F | **自前**（Claude Code サブエージェント + ファイルハンドオフ） | **採用** — 逐次・結果重視・依存の多い作業に対する公式の best fit。追加依存なし。Evaluator 導入・Generator 自律化で実証済み。lead セッションが 3 サブエージェントを逐次起動し、状態をファイルで受け渡す |
| G | **Claude Agent SDK 移行**（#225 C 群「Managed Agents SDK」） | 却下（現時点） — 記事の実証基盤だが、その load-bearing な価値（数時間単一セッションの自動コンパクション・durable execution）に本リポジトリの監督下・小規模運用は未到達。重い新規依存と再プラットフォーム化を「必要時のみ足す」原則に反して先取りすることになる。移行トリガを満たした段階で再評価する |
| H | **Agent Teams**（実験的・並列協調） | 却下 — 並列・独立探索（リサーチ / レビュー / 競合仮説のデバッグ）向けで、実験的（既定無効）・高コスト。本ループは逐次・依存の多い統括であり、並列協調の利得がなくコストと不安定さだけが乗る |
| I | **Ralph ループ**（単一エージェントを while ループで反復・毎回コンテキストリセット） | 純粋形は却下 — 生成と評価を分離しない単一エージェントのブルートフォースで、[ADR-0038](./0038-autonomous-agent-loop-adoption.md) が確定した分離方針と相容れない。ただし**駆動形状（ステートレス反復 + ファイル / git 状態 + 検証 exit gate）は採用案 F が既に内包**しており、無人化時の driver オプションとして温存する（Decision §3） |

## Decision

1. **自律ループのオーケストレーションは自前（Claude Code サブエージェント + ファイルハンドオフ）で確定する**（論点 3-F）。lead セッション（メインの Claude Code セッション）が planner / generator / evaluator サブエージェントを**逐次**起動し、状態は仕様ファイル・作業ツリー + コミット・採点レポートの**ファイル**で受け渡す。駆動手順は [long-running-app-harness.md §9.3](../guides/long-running-app-harness.md) を SSoT とする。

2. **採用案 F は Ralph ループの駆動形状を役割分離版として内包する**。サブエージェントは起動ごとに独立コンテキストを持ち（= 反復ごとのフレッシュコンテキスト）、ファイルハンドオフで状態を外出しし（= 外部 git / ファイル状態）、Evaluator の PASS / NEEDS_WORK が exit gate になる（= 検証ゲート）。すなわち本案は「生成と評価を分離した Ralph 様ループ」であり、Ralph の利点を単一エージェントのブルートフォースに退化させずに得る。

3. **Claude Agent SDK / Managed Agents SDK は見送りを継続する**（#225 C 群）。ただしループは**エージェント単位でモデル指定可能（model-agnostic）**に設計する方針（[ADR-0038](./0038-autonomous-agent-loop-adoption.md) Decision §5）を維持し、将来の移行を阻害しない。

4. **無人化時の駆動オプションと移行トリガ（再検討契機）を明記する**。以下のいずれかに到達したら、駆動形状（**Ralph 式 while ループ駆動** または **Claude Agent SDK**）を再評価する:

   | トリガ | 内容 |
   | --- | --- |
   | 無人・多時間運用の常態化 | 数時間規模の無人実行が常態化し、人手監督前提（仕様合意・PR ゲート）が運用上崩れる |
   | コンテキスト破綻 | 自動コンパクションなしでコンテキストが破綻する（context anxiety の再発）事象が観測される |
   | durable execution の要件化 | プロセス再起動を跨いだ中断・再開（durable execution）が要件化する |
   | 自前保守コストの逆転 | サブインスタンス起動・中断制御・状態受け渡しを自前で支える保守コストが、SDK 採用コストを上回る |

5. **安全網の前提を維持する**。自律ループは egress firewall（[ADR-0037](./0037-ai-execution-sandbox-policy.md) / [ADR-0041](./0041-egress-firewall-nftables-ipv6.md)）の有効を前提とし、起動ヘルスチェックを継続する（[long-running-app-harness.md §8.4](../guides/long-running-app-harness.md)）。自動 fail-close は引き続き見送り、完全無人化（本 Decision §4 のトリガ到達）と同期して再評価する（§9.5）。

## Consequences

- 追加依存なしで 3 者ループを運用できる。一方、lead セッションがサブエージェント間の状態をファイルで受け渡す統括の保守を負う。
- Claude Agent SDK の自動コンパクション・durable execution は得られない。多時間・無人実行へ踏み込むと Decision §4 のトリガに触れ、再評価が必要になる。
- Agent Teams（実験的）の並列探索機構は使わない。逐次ループには不要なため、その並列協調の利得は得られない。
- Ralph ループを純粋形（単一エージェント）では採らないため、その極小実装の手軽さは直接は得ないが、駆動形状は採用案に内包される（Decision §2）。
- 自前オーケストレーションは Claude Code のサブエージェント機構に依存するため、その仕様変更の影響を受ける。
- [ADR-0038](./0038-autonomous-agent-loop-adoption.md) の論点 3 はこれで確定する。本 ADR は手段の確定のみを定め、Planner の運用設計・3 者ループの駆動手順は #291 の成果（[long-running-app-harness.md §9](../guides/long-running-app-harness.md) / [.claude/agents/planner.md](../../.claude/agents/planner.md)）が扱う。
