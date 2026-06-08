# 長時間稼働アプリ向け 3 エージェントハーネスの調査と適用設計

Issue [#270](https://github.com/kuairen-227/agent-team-studio/issues/270)（親トラッカ [#269](https://github.com/kuairen-227/agent-team-studio/issues/269)）の Spike 成果。Anthropic が示した長時間稼働アプリ開発向けの 3 エージェントハーネス（Planner / Generator / Evaluator）を精読し、本リポジトリの既存資産への適用マップ・PoC 最小スコープ・リスクと緩和策を整理する。**実装はスコープ外**で、採否と段階導入方針は [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md)（proposed）で扱う。

全体ハーネスにおける本ループの位置づけは [ai-driven-development.md](./ai-driven-development.md)（「今後の計画」節・施策インベントリ）を参照。

## 1. 記事の要点

出典: Anthropic, [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)（2026 年）。GAN（敵対的生成ネットワーク）に着想を得て、生成と評価を別エージェントに分離した構成。数時間規模の自律コーディングでフルスタックアプリを生成した実験の知見をまとめている。

### 3 エージェントの役割

| エージェント | 役割 |
| --- | --- |
| **Planner** | 1〜4 文の短いプロンプトを、フルのプロダクト仕様へ展開する。「スコープは野心的に」「詳細実装よりプロダクト文脈と高レベル技術設計に集中」と指示される。出力はコードではなく仕様。AI 機能の組み込み余地も仕様に織り込む |
| **Generator** | 仕様をスプリント単位で反復実装する。スプリント完了時に Evaluator へ引き渡す前に自己評価を行う。git でバージョン管理する |
| **Evaluator** | Playwright MCP で稼働中アプリをユーザーのように操作し、UI / API / DB 状態を検証する。スクリーンショットを撮り精査してから評価を下す。プロダクト深度・機能性・ビジュアル・コード品質などの基準で採点し、**いずれか 1 つでも合格しきい値（hard threshold）を下回ればそのスプリントは失敗** |

### スプリント契約（sprint contract）

各スプリント開始前に、Generator と Evaluator が「このチャンクの **done** とは何か」をコードを書く前に合意する。Generator が実装の具体と検証方法を提案し、Evaluator が要件との整合をレビューする。あるスプリントでは 1 スプリントあたり 27 個の判定基準が設定された例がある（例: 「矩形塗りつぶしツールがドラッグで領域を塗る」→ FAIL: ドラッグ始点/終点にしかタイルを置かない）。

### 計画 → 実装 → 検証 → 修復ループ

Planner が仕様を作る → Generator と Evaluator がスプリント契約を交渉 → Generator が実装 → Evaluator が契約基準で検証 → 詳細フィードバック → Generator が反復。エージェント間通信は **ファイル経由**（一方が書き、他方が読む）。

### 検証のしかた

- **ツール**: Playwright MCP で Evaluator が自らページを操作・スクリーンショット・精査してから評価を出す。
- **基準の較正**: デザイン系 4 基準（品質・独創性・作り込み・機能性）を few-shot の採点例で較正した。主観的判断（「良いデザインか？」）を具体的で採点可能な基準へ落とすことが鍵。
- **懐疑性**: 初期の Evaluator は「正当な問題を見つけても、大したことではないと自分を納得させてしまう」傾向があった。評価結果と望ましい結果の乖離をレビューしてプロンプトを反復改善することで矯正した。

### コンテキストの受け渡し

状態は構造化ファイルでハンドオフする。Sonnet 4.5 は「コンテキスト不安（context anxiety）」傾向があり、コンテキストリセットを跨いでも機能するハーネス設計が重要だった。**Opus 4.5 ではこの挙動がほぼ解消され、コンテキストリセットを撤去できた**。

### コスト・信頼性

| 実験 | 所要 | コスト |
| --- | --- | --- |
| 初期（単独実行・ゲーム作成） | 20 分 | $9 |
| 初期（フルハーネス） | 6 時間 | $200 |
| 改良版（DAW 相当） | 約 3 時間 50 分 | $124.70 |

- 単一エージェントより信頼性が高い反面、コストは桁違いに高い（フルハーネスで約 20 倍超）。
- タスクが十分小さい場合、Evaluator は不要なオーバーヘッドになる（境界の見極めが要る）。
- 記事中に **明示的な中断機構・無限ループ抑止・人間チェックポイント** の記述はない（本リポジトリ適用時に補う論点 → §4）。

## 2. 本リポジトリへの適用マップ

3 エージェントの役割は、本リポジトリでは既に **部分的・人手駆動** で存在する。自律ループ化とは「これらを契約・しきい値・反復制御で束ね、人手起点を減らす」こと。

| 記事の構成要素 | 本リポジトリの既存資産 | 状態 |
| --- | --- | --- |
| **Planner**（プロンプト/Issue → 仕様） | `write-product-doc` / `write-design-doc`（仕様）、`create-issue` / `manage-issue`（Issue 構造化）、Issue テンプレートの受入条件 | 人手起点で存在 |
| **Generator**（仕様 → スプリント実装） | `implement-feature`（type-first + 軽量 TDD）、`process-issue`、git / worktree | 人手起点で存在 |
| **Evaluator**（稼働アプリを検証） | `qa` エージェント、Playwright MCP（[ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) / [ai-ui-verification.md](./ai-ui-verification.md)）、`review` / `resolve-review` スキル | 人手起点で存在 |
| **スプリント契約**（done の事前合意） | Issue 受入条件、`implement-feature` Step 0（型差分確認）と RED テスト（done の機械的定義） | 部分的 |
| **ファイル経由ハンドオフ** | `docs/`、Issue / PR、ADR | 存在（自律連携は未） |
| **ループ統括** | 現状は人手で `process-issue` → `implement-feature` → `review` → `resolve-review` を直列に回す | 自律統括は未 |
| **安全網**（暴走時の隔離） | egress allowlist firewall + `permissions.deny` + DevContainer ephemeral（[ADR-0037](../adr/0037-ai-execution-sandbox-policy.md)） | 導入済み |
| **中断機構** | AbortSignal / AbortController（プロダクト側の実証は [ws-llm-spike.md](../design/technotes/ws-llm-spike.md)）、`permissions` による tool 制限 | 部品は存在 |

要点: 検証（Evaluator）の素材は [ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) で既に揃っており、記事が「自己評価は不可分の別エージェントにすべき」とする最も価値の高い分離が、本リポジトリで最短距離にある。

## 3. PoC 最小スコープ（段階案）

全 3 エージェント導入を目標に据えつつ、リスクとコストの低い順に段階的に積む。各 Phase は独立に価値を出し、次へ進む判断材料を残す。

| Phase | スコープ | 狙い / 着手しやすさ |
| --- | --- | --- |
| **Phase 0**（現状） | 人手駆動の疑似ループ（`process-issue` → `implement-feature` → `review`） | 既存。ベースライン |
| **Phase 1: Evaluator 自動化** | `qa` + Playwright を `review` から自律呼び出しし、**合格しきい値を機械化**（基準を採点可能な形に較正） | 記事の最大の知見（自己評価の分離）を最小コストで検証。失敗時も人手レビューへフォールバック |
| **Phase 2: Generator スプリント化** | `implement-feature` を**スプリント契約付き**で複数サイクル自律実行。反復上限・コスト上限を機械的に課す | 自律実装の暴走/コスト挙動をここで測る |
| **Phase 3: Planner + 3 者統合** | プロンプト/Issue → 仕様の自動展開を `write-*-doc` に接続し、3 者ループを統括。**全採用の到達点** | フル自律。オーケストレーション手段（自前 vs SDK）を §5 の再評価に基づき確定 |

各 Phase の Go/No-Go は、コスト実測・合格率・人手介入頻度を見て判断する。

## 4. リスクと緩和策

| リスク | 緩和策 |
| --- | --- |
| **コスト**（フルで $124〜200/run） | トークン/時間バジェットの上限設定。Phase で段階課金を観測。高コストな Opus フル稼働は対象タスクの規模で正当化できる範囲に限定（記事「小タスクでは Evaluator は過剰」） |
| **暴走・無限ループ** | 合格しきい値の機械化 + **最大スプリント数 / 最大反復回数の上限**。Evaluator の懐疑性チューニング（記事の「自分で問題を見逃す」教訓）。しきい値を下回り続ける場合は人手へエスカレーション |
| **中断（AbortSignal）** | 実行中断は AbortController / `AbortSignal.any`（多階層 signal、[ws-llm-spike.md](../design/technotes/ws-llm-spike.md) で実証済みパターン）。tool レベルの遮断は `permissions.deny` |
| **人間チェックポイント** | 記事に明示機構がない分を本リポジトリの **PR / Issue ゲート** で補う。スプリント契約合意・PR 作成・ADR 要否の各点で human-in-the-loop を置く |
| **データ持ち出し（exfiltration）** | [ADR-0037](../adr/0037-ai-execution-sandbox-policy.md) の egress allowlist firewall（default-deny）。無人・長時間ほど価値が上がる。ADR-0037 が残した **fail-close（適用失敗時のコンテナ停止）/ 起動ヘルスチェックの要否**は、本ループ無人実行の設計時に再評価する |
| **状態の継承漏れ** | 構造化ファイルハンドオフ（記事準拠）。Opus 4.5 はコンテキストリセット不要のため、リセット跨ぎ設計の負荷は下がる |

## 5. 見送り候補の再評価（#225 B / C 群）

[#225](https://github.com/kuairen-227/agent-team-studio/issues/225)（磨き上げ軸）で見送った候補のうち、自律ループ文脈で重要度が上がるものを再評価する。

| 候補 | #225 時点 | 自律ループ文脈での再評価 |
| --- | --- | --- |
| **auto memory 活用**（B 群） | 見送り | セッション跨ぎの状態継承ニーズが出る。ただし記事は **構造化ファイルハンドオフ + コンテキストリセット**で対応し、Opus 4.5 ではリセット自体が不要化。→ auto memory より「構造化ファイルハンドオフ（`docs/` / artifact）」を優先候補とし、auto memory は Phase 2 以降で必要性を再判定 |
| **Managed Agents SDK 移行**（C 群） | 見送り | 3 者ループのオーケストレーション（サブインスタンス起動・ファイル受け渡し・中断制御）はまさに SDK の想定領域。自前実装（Claude サブインスタンス + file handoff）との比較を **Phase 3 着手時**に再評価。Phase 1〜2 は既存スキル/エージェントの範囲で自前検証する |

## 6. 受け入れ条件への対応（#270）

| #270 受入条件 | 対応 |
| --- | --- |
| 調査メモ（記事要点 + 適用マップ）が docs に残る | 本ノート §1・§2 |
| ADR ドラフト（採否と段階導入方針） | [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md)（proposed） |
| PoC 最小スコープ提案 | 本ノート §3 |
| リスクと緩和策（中断・チェックポイント・コスト上限） | 本ノート §4 |

## 参照

| ドキュメント | 内容 |
| --- | --- |
| [ai-driven-development.md](./ai-driven-development.md) | 全体ハーネス（本ループの位置づけ・施策インベントリ） |
| [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md) | 自律エージェントループの採否と段階導入方針（proposed） |
| [ADR-0037](../adr/0037-ai-execution-sandbox-policy.md) | 実行サンドボックス方針（egress firewall = 自律実行の安全網） |
| [ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) | Playwright MCP（Evaluator の検証基盤） |
| [ADR-0011](../adr/0011-role-based-agent-architecture.md) | ロールベースエージェント（本ループは別系統） |
| [ai-ui-verification.md](./ai-ui-verification.md) | Playwright による UI 検証手順 |
| [ws-llm-spike.md](../design/technotes/ws-llm-spike.md) | AbortSignal 中断パターンの実証 |
