# 長時間稼働アプリ向け 3 エージェントハーネスの調査と適用設計

Issue [#270](https://github.com/kuairen-227/agent-team-studio/issues/270)（親トラッカ [#269](https://github.com/kuairen-227/agent-team-studio/issues/269)）の Spike 成果。Anthropic が示した長時間稼働アプリ開発向けの 3 エージェントハーネス（Planner / Generator / Evaluator）を精読し、本リポジトリの既存資産への適用マップ・PoC 最小スコープ・リスクと緩和策を整理する。**実装はスコープ外**で、採否と段階導入方針は [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md)（accepted）で扱う。

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

各スプリント開始前に、Generator と Evaluator が「このチャンクの **done** とは何か」をコードを書く前に合意する。Generator が実装の具体と検証方法を提案し、Evaluator が要件との整合をレビューし、両者が合意するまで往復する。高レベルな仕様と「テスト可能な実装」の橋渡しを担う。契約は粒度が細かく、レトロゲームメーカーの例では **Sprint 3 だけで 27 個** の判定基準があった（例: 「矩形塗りつぶしツールがドラッグで領域を塗る」→ FAIL: ドラッグ始点/終点にしかタイルを置かない）。

### 計画 → 実装 → 検証 → 修復ループ

Planner が仕様を作る → Generator と Evaluator がスプリント契約を交渉 → Generator が実装 → Evaluator が契約基準で検証 → 詳細フィードバック → Generator が反復。エージェント間通信は **ファイル経由**（一方が書き、他方が読む）。

### 検証のしかた

- **ツール**: Playwright MCP で Evaluator が自らページを操作・スクリーンショット・精査してから評価を出す。
- **基準の較正**: デザイン系 4 基準（品質・独創性・作り込み・機能性）を few-shot の採点例で較正した。主観的判断（「良いデザインか？」）を具体的で採点可能な基準へ落とすことが鍵。
- **懐疑性**: 初期の Evaluator は「正当な問題を見つけても、大したことではないと自分を納得させてしまう」傾向があった。評価結果と望ましい結果の乖離をレビューしてプロンプトを反復改善することで矯正した。

### オーケストレーションとコンテキストの受け渡し

ループは **Claude Agent SDK** 上に構築され、SDK の自動コンパクションがコンテキスト増大を処理する。状態は構造化ファイルでハンドオフする。

ここで **コンテキストリセット**（コンテキストを完全にクリアし、構造化ハンドオフで状態を引き継いだ新エージェントを起動）と **コンパクション**（同じエージェントが履歴を要約して継続）は別物。Sonnet 4.5 は「コンテキスト不安（context anxiety）」が強く、コンパクションだけでは不十分でリセットが必須だった。**Opus 4.5 ではこの挙動がほぼ解消され、リセットを撤去して単一連続セッション + 自動コンパクションで全ビルドを走らせた**。

### ハーネスの進化（V1 → V2）とモデル世代依存性

記事の最重要教訓: **ハーネスの各部品は「モデルが単独でできないこと」の仮定であり、モデルが良くなると陳腐化する**。指針は「最も単純な解から始め、必要なときだけ複雑さを足す」（Building Effective Agents）。新モデルが出たら、効かなくなった足場を剥がし、新たに可能になった能力を足してハーネスを再点検する。

| 版 | モデル | 構成 | 例 / コスト |
| --- | --- | --- | --- |
| **V1** | Opus 4.5 | 3 エージェント + **スプリント**（契約・per-sprint 採点） | レトロゲームメーカー。単独 20 分/$9 に対しフルハーネス **6 時間/$200**（20 倍超） |
| **V2** | Opus 4.6 | **スプリント撤廃**。Planner / Evaluator は維持、Evaluator は**最後の単一パス**採点へ | DAW。**約 3 時間 50 分/$124.70**（Build が 2 時間超を一貫実行） |

- V2 で Planner を外すと Generator はスコープを過小に取る（仕様化せず実装を始める）ため、**Planner と Evaluator は引き続き価値がある**。
- **Evaluator は固定の yes/no 判断ではない**。タスクがモデルの単独能力を超える領域にあるときコストに見合う。モデルが強くなるほどその境界は外へ動き、境界内のタスクでは Evaluator は過剰オーバーヘッドになる。
- 記事中に **明示的な中断機構・無限ループ抑止・人間チェックポイント** の記述はない（本リポジトリ適用時に補う論点 → §4）。

## 2. 適用方針：best-practice 優先で purpose-built

記事のハーネスは既存ツールの寄せ集めではなく、**専用エージェント（dedicated personas）を Claude Agent SDK 上に新規構築**したもの。本リポジトリでも **best practice を優先し、3 エージェントは purpose-built で設計する**。既存のロールベースエージェント（`qa` 等、[ADR-0011](../adr/0011-role-based-agent-architecture.md)）や人手前提スキル（`implement-feature` / `review`）は **再利用を強制する制約ではなく、参照・流用してよい素材** として扱う。とくに `qa` は human-in-the-loop のレビュー視点で、自律 Evaluator（較正済みルーブリック + hard threshold + Playwright 自走）とは意図が異なるため、**役割を流用せず別物として作る**。

### purpose-built で作るもの（記事準拠の中核）

| エージェント | best-practice 設計 |
| --- | --- |
| **Planner** | 1〜4 文 → 仕様の専用プロンプト。野心的スコープ、product 文脈と高レベル設計に集中（詳細実装は下流に委ね、誤りの連鎖を避ける）。AI 機能の織り込み |
| **Generator** | 仕様に対し自律実装する専用エージェント。自己評価してから Evaluator へ。git 管理。型駆動 / 軽量 TDD の規律を**参照**してよいが、`implement-feature`（人手手順）に縛られない |
| **Evaluator** | 較正済み採点ルーブリック（few-shot + 詳細スコア内訳）と **hard threshold**、Playwright で自走検証する専用エージェント。懐疑性をプロンプトで作り込む（素の Claude は QA が甘い）。`qa` を流用せず新規 |

### 流用してよい素材（ツール・基盤・規律）

これらは「ベストプラクティスそのもの」なので積極的に使う。アーキテクチャを縛るためではなく、使える部品として:

| 素材 | 流用理由 |
| --- | --- |
| **Playwright MCP**（[ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md)） | 記事の Evaluator と同じ検証手段。そのまま中核ツール |
| **Claude Agent SDK** | 記事の実証オーケストレーション基盤（自動コンパクション含む）。§5 参照 |
| **ファイルハンドオフ基盤**（`docs/` / Issue / PR） | 構造化ハンドオフの実体。エージェント間通信に流用 |
| **安全網**（egress firewall + `permissions.deny` + DevContainer、[ADR-0037](../adr/0037-ai-execution-sandbox-policy.md)） | 無人実行の前提。そのまま前段に置く |
| **中断機構**（AbortController / `AbortSignal.any`、[ws-llm-spike.md](../design/technotes/ws-llm-spike.md)） | 実証済みパターンを流用 |

要点: 記事の最大の知見（生成と評価を**別エージェントに分離**）を最優先し、Evaluator は `qa` の延長ではなく**専用に作り込む**。既存資産は再利用を前提にせず、ベストプラクティスに合うものだけ部品として使う。

## 3. PoC 最小スコープ（段階案）

全 3 エージェント（Planner / Generator / Evaluator）導入を目標に据えつつ、リスクとコストの低い順に段階的に積む。記事の指針に従い **最も単純な構成から始め、必要なときだけ足場を足す**。とくに **スプリント機構は必須ではなくモデル能力依存の足場**（記事 V2 では撤廃）なので、まず足場なしで始め、対象タスクがモデルの単独能力を超えて初めて導入を検討する。各 Phase は独立に価値を出し、次へ進む判断材料を残す。

| Phase | スコープ | 狙い / 着手しやすさ |
| --- | --- | --- |
| **Phase 0**（現状） | 人手駆動の疑似ループ（`process-issue` → `implement-feature` → `review`）。ベースライン | 既存 |
| **Phase 1: Evaluator** | **専用 Evaluator エージェントを新規構築**（較正ルーブリック + hard threshold + Playwright 自走）。まずは**最後の単一パス**採点（記事 V2 相当）。既存の人手レビュー（`review` / `qa`）はフォールバックとして併存 | 記事の最大の知見（自己評価の分離）を最小コストで検証。`qa` の延長ではなく専用に作る |
| **Phase 2: Generator** | **専用 Generator エージェント**で Planner 仕様を自律実装（型駆動 / 軽量 TDD を規律として参照）。反復上限・コスト上限を機械的に課す。**スプリント契約 + per-sprint 採点（記事 V1 相当）は、タスクがモデル単独能力を超える場合にのみ足す** | 自律実装の暴走/コスト挙動をここで測る |
| **Phase 3: Planner + 統合** | **専用 Planner**（プロンプト/Issue → 仕様）+ 3 者ループ統括。**全採用の到達点** | フル自律。オーケストレーションは §5 の再評価で Claude Agent SDK / 自前を確定 |

各 Phase の Go/No-Go は、コスト実測・合格率・人手介入頻度を見て判断する。Evaluator は固定で挟むのではなく、タスクがモデル単独能力を超えるときに投入する（§1 の教訓）。エージェントは既存スキルの流用を前提とせず purpose-built で作り、Playwright MCP・Agent SDK・安全網など§2 の素材のみ流用する。

## 4. リスクと緩和策

| リスク | 緩和策 |
| --- | --- |
| **コスト**（フルで $124〜200/run） | トークン/時間バジェットの上限設定。Phase で段階課金を観測。高コストな Opus フル稼働は対象タスクの規模で正当化できる範囲に限定（記事「小タスクでは Evaluator は過剰」） |
| **モデル階層化**（コスト最適化） | コストはほぼ Generator に偏る（V2 実測で約 91%。Planner 約 0.4% / Evaluator 約 8%）。**Generator は能力境界内の定型タスクで Sonnet 併用を検討**し、Planner / Evaluator は判断品質・連鎖影響を優先して強モデル（Opus）に据え置く。ただし Generator を弱めると Evaluator の反復が増え QA 往復で食い潰し得るため、合格率・総コスト（QA 込み）を Phase 2 で実測して採否を決める。ループはエージェント単位でモデル指定可能（model-agnostic）に設計する。プロダクト側のマルチベンダー方針（[ADR-0032](../adr/0032-llm-multi-vendor-strategy.md) / [ADR-0034](../adr/0034-llm-client-ai-sdk.md)）とは別物のハーネス側選択 |
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
| **Managed Agents SDK 移行**（C 群） | 見送り | **記事のハーネスは Claude Agent SDK 上に構築**され、自動コンパクション・オーケストレーションを SDK が担っている。3 者ループのサブインスタンス起動・ファイル受け渡し・中断制御は SDK の想定領域で、実証パスでもある。自前実装との比較を **Phase 3 着手時**に再評価。Phase 1〜2 は既存スキル/エージェントの範囲で自前検証する |

## 6. 受け入れ条件への対応（#270）

| #270 受入条件 | 対応 |
| --- | --- |
| 調査メモ（記事要点 + 適用マップ）が docs に残る | 本ノート §1・§2 |
| ADR ドラフト（採否と段階導入方針） | [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md)（accepted） |
| PoC 最小スコープ提案 | 本ノート §3 |
| リスクと緩和策（中断・チェックポイント・コスト上限） | 本ノート §4 |

## 参照

| ドキュメント | 内容 |
| --- | --- |
| [ai-driven-development.md](./ai-driven-development.md) | 全体ハーネス（本ループの位置づけ・施策インベントリ） |
| [ADR-0038](../adr/0038-autonomous-agent-loop-adoption.md) | 自律エージェントループの採否と段階導入方針（accepted） |
| [ADR-0037](../adr/0037-ai-execution-sandbox-policy.md) | 実行サンドボックス方針（egress firewall = 自律実行の安全網） |
| [ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) | Playwright MCP（Evaluator の検証基盤） |
| [ADR-0011](../adr/0011-role-based-agent-architecture.md) | ロールベースエージェント（本ループは別系統） |
| [ai-ui-verification.md](./ai-ui-verification.md) | Playwright による UI 検証手順 |
| [ws-llm-spike.md](../design/technotes/ws-llm-spike.md) | AbortSignal 中断パターンの実証 |
