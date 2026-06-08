# Spike 調査ノート: Plan/Verify 自律エージェントループ

Issue [#270](https://github.com/kuairen-227/agent-team-studio/issues/270)（親トラッカ [#269](https://github.com/kuairen-227/agent-team-studio/issues/269)）の調査結果。**実装はスコープ外**。Anthropic の長時間稼働アプリ向けハーネス設計を精読し、本リポジトリの既存資産への適用マップ・PoC 最小スコープ・リスクと緩和策を整理する。採否と段階導入方針は [ADR-0038](../../adr/0038-plan-verify-autonomous-loop.md) に記録する。

## 調査ソース

| ソース | 種別 | 取得方法・注記 |
| --- | --- | --- |
| [anthropics/cwc-long-running-agents](https://github.com/anthropics/cwc-long-running-agents) | 公式リファレンス実装 | Code with Claude 2026「Long-Running Agents」課題。Claude Code config（`.claude/`）として公開。raw ファイルを直接取得 |
| [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Anthropic Engineering 記事 | 記事本体は WebFetch が 403。要点は検索結果・上記リポジトリ・二次解説から再構成（実機未取得） |
| [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Anthropic Engineering 記事 | 同上 |

> リポジトリは「これは turnkey ハーネスではなく**材料（ingredients）**。各プリミティブは独立した 1 ファイルで、cherry-pick して各プロジェクトに合わせろ」と明言している。本リポジトリも全採用ではなく必要なプリミティブを選んで段階導入する前提で読む。

## 1. ハーネス設計の要点

### 3 エージェント構成（GAN 着想）

| エージェント | 役割 | 出力 |
| --- | --- | --- |
| **Planner** | 1〜4 文の短いプロンプトを詳細なプロダクト仕様（`BUILD_PLAN.md` 等）へ展開する。粒度の細かい技術詳細は指定せず、**成果物（deliverables）**で制約してパスはエージェントに任せる | 仕様（コードではない） |
| **Generator**（Builder / Implementer） | 仕様をスプリント単位に分割し、**1 セッション 1 機能**で段階実装。`PROGRESS.md` に進捗を残しチェックポイントで commit | コード + 進捗・証拠 |
| **Evaluator**（Verifier） | 懐疑的な第三者レビュアー。**fresh context**（新しいコンテキストウィンドウ）で diff と証拠を見て、稼働中アプリを Playwright で操作・検証し、`PASS` / `NEEDS_WORK` を返す。Builder の自己採点を許さない | PASS/FAIL 判定 + 具体的指摘 |

3 者は **sprint contract**（このチャンクの「done」とは何か）をコード着手前に合意し、**plan → build → test → repair** のループを回す。単一エージェントより信頼性が高い反面、コストも高い。

### リファレンス実装が示す 3 つのコアプリミティブ

| プリミティブ | 仕組み | リファレンスの実体 |
| --- | --- | --- |
| **Default-FAIL Contract** | 受入基準は `test-results.json` で全て `false` 始まり。証拠ファイル（スクリーンショット / ログ）を Read するまで結果ファイルへの書込を `PreToolUse` フックが拒否する。「証拠を見ずに成功宣言できない」 | `hooks/verify-gate.sh` + `hooks/track-read.sh` |
| **Fresh-context Evaluator** | Write/Edit を持たない別サブエージェントが、クリーンな文脈で完成物を採点。`PASS` / `NEEDS_WORK` を返し、後者は Builder の次プロンプトに供給される | `agents/evaluator.md`（`tools: Read, Glob, Grep, Bash`） |
| **Agent-maintained Handoff** | 自動要約に頼らず、エージェント自身が `PROGRESS.md`（`Done` / `In progress` / `Next` / `Notes`）に状態を書き、再開時に読み直し、git に commit してセッション境界を越えて継続する | `CLAUDE.md` + `hooks/commit-on-stop.sh` |

### オペレータ制御・運用

| 仕組み | リファレンスの実体 | 効果 |
| --- | --- | --- |
| Kill switch | `hooks/kill-switch.sh` | `touch AGENT_STOP` で全 tool call を `block`。`rm` で再開 |
| Steering | `hooks/steer.sh` | `STEER.md` を置くと run 中に一度だけ軌道修正指示を注入（`OPERATOR STEERING:` が計画作業に優先） |
| 実行方式 | `/goal "..."`（組み込み）/ headless（`claude -p`）の while ループ wrapper / Agent SDK の `PreToolUse`・`Stop` コールバック | 同じパターンを 3 つの実行面で実現 |

ループ wrapper の最小形（リファレンスより）:

```bash
while grep -q '"passes": false' test-results.json; do
  claude -p "Read PROGRESS.md and build the next unfinished feature per CLAUDE.md."
  VERDICT=$(claude --agent evaluator -p "Review the most recent commit against its spec.")
  [ "$(echo "$VERDICT" | head -1)" = "PASS" ] || echo "$VERDICT" > NEXT_FINDINGS.md
done
```

## 2. 本リポジトリ適用マップ

3 エージェントの役割は、既存資産に概ね写像できる。**多くは「新規構築」ではなく「既存の人手駆動手順を自律ループ化」する話**である。

| ハーネス役割 | 本リポジトリの既存資産 | ギャップ（自律化に不足する分） |
| --- | --- | --- |
| **Planner** | 要件→仕様の流れ（[process-issue](../../../.claude/skills/process-issue/SKILL.md) の計画立案 / [write-design-doc](../../../.claude/skills/write-design-doc/SKILL.md) / [write-product-doc](../../../.claude/skills/write-product-doc/SKILL.md)）、Issue/PR テンプレート | 短いプロンプト → 構造化仕様（`BUILD_PLAN.md` 相当）への自動展開と sprint 分割は未自動化 |
| **Implementer** | [implement-feature](../../../.claude/skills/implement-feature/SKILL.md)（type-first + 軽量 TDD）、Turborepo、`post-edit-lint.sh` フック | セッション跨ぎの `PROGRESS.md` ハンドオフ、checkpoint 自動 commit は未導入 |
| **Verifier** | [qa エージェント](../../../.claude/agents/qa.md)、[review](../../../.claude/skills/review/SKILL.md) / [resolve-review](../../../.claude/skills/resolve-review/SKILL.md)、Playwright MCP（[ADR-0024](../../adr/0024-playwright-mcp-for-ai-verification.md)）、[ai-ui-verification.md](../../guides/ai-ui-verification.md) | fresh-context での自動採点、機械的 PASS/FAIL ゲート、証拠ベース contract は未導入 |

プリミティブ → 本リポジトリ資産の対応:

| リファレンスのプリミティブ | 本リポジトリの対応 | 状況 |
| --- | --- | --- |
| `PreToolUse` フックによる enforcement | `.claude/hooks/`（現状 `PostToolUse` の `post-edit-lint.sh` のみ）、`permissions.deny` | 仕組みは保有。`PreToolUse` ゲートは未使用 |
| Fresh-context Evaluator（サブエージェント） | `.claude/agents/qa.md`（ただし `review` スキル経由の人手駆動） | エージェント定義の様式は確立済み。自律呼び出しが未整備 |
| 稼働アプリの操作検証 | Playwright MCP | 導入済み（人手駆動の UI 検証） |
| Agent-maintained Handoff（`PROGRESS.md` + commit） | Issue / PR / commit 履歴 | GitHub 側に状態はあるが、セッション内ハンドオフ規約は未定義 |
| Kill switch / Steering | （未導入） | egress firewall（[ADR-0037](../../adr/0037-ai-execution-sandbox-policy.md)）/ `permissions.deny` が隣接の安全網 |
| 安全網（ネットワーク隔離） | egress allowlist firewall（[ADR-0037](../../adr/0037-ai-execution-sandbox-policy.md)）、DevContainer、`permissions.deny` | **導入済み**。自律実行の前提となる安全網は #271 で先行整備済み |

> 本リポジトリは MVP（プロダクト）が WebSocket + LLM streaming のエージェント実行基盤を持つ（[agent-execution.md](../agent-execution.md)）。これは**プロダクトとしてのエージェント**であり、本ノートが扱う**開発プロセスとしての自律ループ**とは別レイヤ。混同しない。

## 3. PoC 最小スコープ（段階案）

リファレンスの「cherry-pick」方針に従い、価値が高く・リスクが低く・既存資産の再利用度が高い順に段階化する。**Verifier 先行**を採る（[ADR-0038](../../adr/0038-plan-verify-autonomous-loop.md) の決定と整合）。

| 段階 | スコープ | 再利用する既存資産 | 追加で要るもの |
| --- | --- | --- | --- |
| **0（前提・済）** | 安全網（egress firewall / permissions / DevContainer） | ADR-0037 | — |
| **1（Verifier 先行）** | fresh-context Evaluator サブエージェントを 1 つ追加し、`implement-feature` 完了物を懐疑的に PASS/NEEDS_WORK 判定。人間がループを回す（半自律） | qa エージェント、Playwright MCP、review スキル | `evaluator` 相当エージェント定義、証拠の置き場規約 |
| **2（contract ゲート）** | Default-FAIL contract（受入基準ファイル + `PreToolUse` ゲート）で「証拠なし成功宣言」を機械的に防ぐ | hooks 機構、permissions | `verify-gate` 相当フック、`test-results.json` 規約 |
| **3（ハンドオフ）** | `PROGRESS.md` ハンドオフ + checkpoint commit でセッション跨ぎ継続 | git、CLAUDE.md 規約 | ハンドオフ規約、`commit-on-stop` フック |
| **4（自律ループ）** | `/goal` or wrapper で plan→build→test→repair を無人ループ化。kill-switch / steer を併設 | 上記すべて | ループ駆動、オペレータ制御フック、コスト上限 |

段階 1 だけでも「自己採点の排除」という単体エージェント比の主要な信頼性向上が得られ、追加コストは限定的。段階 4 へ進むかは段階 1〜3 の費用対効果を見て判断する。

## 4. リスクと緩和策

| リスク | 緩和策（本リポジトリで取れる手） |
| --- | --- |
| **コスト**（複数エージェント × 長時間でトークン増） | 段階導入で適用範囲を絞る / セッション・反復回数の上限 / 安価モデルでゲート判定（`/goal` の条件チェックは別の高速モデル） |
| **暴走・無限ループ**（NEEDS_WORK が永遠に解消しない） | 反復回数キャップ + kill switch（`AGENT_STOP`）/ 段階 1 は人間がループを回すため無限ループは原理的に発生しない |
| **中断**（実行中の停止） | LLM 呼び出しは `AbortSignal` で即時中断可能（[ws-llm-spike.md](./ws-llm-spike.md) で実証済み、`APIUserAbortError`）。フックレベルは kill-switch |
| **データ持ち出し（exfiltration）** | egress allowlist firewall（default-deny、[ADR-0037](../../adr/0037-ai-execution-sandbox-policy.md)）+ `permissions.deny`（`curl`/`wget`/`.env` 読取）で多重防御。**自律ループの前提として #271 で先行整備済み** |
| **人間チェックポイントの喪失**（[principles §1 ユーザー判断優先](../../principles/README.md)との緊張） | 段階 1〜3 は人間がループ駆動 / steering（`STEER.md`）で介入点を残す / 自律化（段階 4）は ADR で明示合意してから |
| **fail-open**（firewall 構成失敗時に無防備起動、ADR-0037 で実機確認済み） | 無人実行（段階 4）着手時に fail-close / 起動ヘルスチェックを再評価（ADR-0037 Consequences で #270 へ申し送り済み） |
| **Evaluator の甘い採点**（plausibility ≠ correctness） | 証拠ファイルの Read を contract で強制（Default-FAIL）/ Evaluator は Write/Edit を持たない fresh-context |

## 5. 見送り候補の再評価（自律ループ文脈）

磨き上げ軸（#225）で見送った 2 群を、自律ループ文脈で再評価する。

| 候補 | 自律ループでの重要度 | 評価 |
| --- | --- | --- |
| **auto memory 活用**（#225 B 群） | ↑ | リファレンスは「自動要約に頼らず `PROGRESS.md` でエージェント自身がハンドオフ」を推奨。本リポジトリの方向（Issue/PR/commit + 明示ハンドオフ規約）と整合し、auto memory への依存はむしろ不要と再確認。段階 3 で `PROGRESS.md` 相当を検討 |
| **Managed Agents SDK 移行**（#225 C 群） | ↑ | リファレンスは同一パターンを Claude Code（hooks / subagents）と Agent SDK（`PreToolUse`/`Stop` コールバック）の両面で提示。Claude Code 上で段階 1〜3 まで実現可能なため、SDK 移行は段階 4（無人ループ）で必要になった時点で再判断。前倒し不要 |

## 結論

- Anthropic の 3 エージェントハーネスは、本リポジトリの既存資産（hooks / agents / Playwright MCP / permissions / egress firewall）に**ほぼ 1:1 で写像でき**、多くは新規構築でなく「人手駆動手順の自律ループ化」である。
- 安全網（段階 0）は #271 で先行整備済み。価値・リスク・再利用度から **Verifier 先行（段階 1）**を起点とする段階導入が妥当。
- 採否と段階導入方針は [ADR-0038](../../adr/0038-plan-verify-autonomous-loop.md)（proposed）に記録。実装着手は v1.1 スコープ外とし、段階 1 の費用対効果を見て v1.2 以降で判断する。
