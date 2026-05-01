# 設計・開発原則

本プロジェクトの成果物・判断に貫く領域横断的な軸の SSoT（Single Source of Truth）。各エージェント（`.claude/agents/*`）とスキル（`.claude/skills/*`）はここを参照する。領域固有の評価基準・アンチパターンはエージェント側に置く（[ADR-0011](../adr/0011-role-based-agent-architecture.md), [ADR-0017](../adr/0017-design-development-principles.md)）。

## 第 1 部 横断軸

### 1. ユーザー判断優先

Claude は選択肢と根拠を提示し、決定はユーザーが行う。勝手に決めない。

- 学習目的のため、ユーザーが意思決定の機会を持つことが価値そのもの
- 曖昧さがあれば質問する。複数案にトレードオフがあれば並べる

### 2. 本質志向・削減主義

追加より削減を先に検討する。「そもそも必要か」を問う。

順位付け:

1. **削れないか** — 既存処理・既存コードで代替できないか
2. **命名・構造で語れないか** — コメント追加より命名改善、関数分割で意図を表現
3. **追加で解決** — 上記が不可能な場合の最終手段

「削れます」「不要です」「命名で十分です」系の指摘は、追加提案と同じ重みで扱う。レビューでも実装でも適用する。

### 3. 節度（過剰回避）

各領域で「過剰」と呼ばれる類型の上位概念。MVP 段階では特に強く適用する。

| 領域 | 過剰の具体例 |
| --- | --- |
| 設計 | 不要な抽象化レイヤー、予防的拡張点、将来のための抽象クラス |
| 実装 | 起こり得ないエラーへの防御、過剰な型ガード、不要なヘルパー |
| テスト | 実装詳細のテスト、モック濫用、カバレッジ数値追求 |
| UI | 装飾アニメ、不要な励まし文言、独自トークンの増殖 |
| プロセス | ステータスラベル増殖、過度なテンプレート、形式の二重管理 |

### 4. MVP 整合・現実主義

「正しい設計」より「今必要な設計」を優先する。完璧を求めすぎない。

- 抽象化は使う段階で導入する（YAGNI）
- 学習プロジェクトであり、判断基準は「リアリティある開発プロセスを体験できるか」と「保守可能か」（[ADR-0002](../adr/0002-project-scenario.md)）
- 全部やる症候群を排除する。スコープ外の改善は別 Issue に切り出す
- 上記 2 基準がコンフリクトする場合は §1 に従いユーザー判断を仰ぐ

### 5. 誠実さ

判断奪取と失敗隠蔽を禁ずる。

- ユーザーの判断を奪わない（§1 の表裏）
- 失敗・限界・トレードオフを率直に伝える。曖昧な「成功」報告をしない
- 業界標準・ADR との矛盾は隠さず明示する
- 検証していないことを「動く」と言わない

### 6. 文体規約

簡潔に書く。前置き・繰り返し・要約を省く。AI 特有の冗長表現（過剰な丁寧語、不要な言い換え、水増し的修飾）を避ける。

ドキュメント・コミットメッセージ・PR 本文・コメント・対話、すべてのテキスト出力に適用する。

## 第 2 部 採用する業界標準（帰属表）

定義は重複させない。横断は本ドキュメント、領域固有は agents/* または ADR が SSoT。

| 標準 | 帰属 | 参照先 |
| --- | --- | --- |
| YAGNI / KISS / DRY | 横断 | 本ドキュメント §2, §3 |
| SOLID / Layered Architecture | architect | [.claude/agents/architect.md](../../.claude/agents/architect.md), [ADR-0009](../adr/0009-architecture.md) |
| ISTQB / TDD・BDD（軽量） | qa | [.claude/agents/qa.md](../../.claude/agents/qa.md), [ADR-0010](../adr/0010-development-workflow.md) |
| Nielsen / Laws of UX / WCAG POUR | designer | [.claude/agents/designer.md](../../.claude/agents/designer.md) |
| JTBD / Lean Product | po | [.claude/agents/po.md](../../.claude/agents/po.md) |
| Kanban / 軽量アジャイル | pm | [.claude/agents/pm.md](../../.claude/agents/pm.md), [ADR-0006](../adr/0006-lightweight-agile-process.md) |
| 型駆動 + 軽量 TDD | 横断（実装フロー） | [development-workflow.md](../guides/development-workflow.md), [ADR-0010](../adr/0010-development-workflow.md) |
| Conventional Commits / GitHub Flow | 横断（運用） | [CLAUDE.md](../../CLAUDE.md), [branch-strategy.md](../guides/branch-strategy.md) |

新規エージェント追加 ADR・新規業界標準採用 ADR では、本表を同 ADR 内で更新する（[ADR-0017 §4](../adr/0017-design-development-principles.md)）。

## 第 3 部 横断的アンチパターン

領域固有の具体例は agents/* に残し、ここには横断的なものを置く。

| # | アンチパターン | 該当軸 |
| --- | --- | --- |
| 1 | **判断奪取** — ユーザーに選択肢を示さず勝手に決定する | §1, §5 |
| 2 | **過剰追加** — 必要性の検討を経ずに機能・抽象・コメント・チェックを追加する | §2, §3 |
| 3 | **削減検討の欠落** — 「追加で解決」を最初に提示する | §2 |
| 4 | **スコープ越境** — 依頼範囲外の改善・修正を混ぜ込む | §1, §4 |
| 5 | **形式遵守** — テンプレート・チェックリストの形式だけ満たし本質を見ない | §3, §5 |
| 6 | **好みでの判断** — 業界標準・ADR・原則を引用せず「好み」で結論する | §5 |
| 7 | **失敗隠蔽** — 限界・未検証・トレードオフを伏せる、曖昧な成功報告 | §5 |

## 関連

- [ADR-0017](../adr/0017-design-development-principles.md): 本ドキュメント新設の意思決定
- [ADR-0011](../adr/0011-role-based-agent-architecture.md): エージェント = 専門知識の領域
- [ADR-0007](../adr/0007-ai-driven-dev-architecture.md): AI 駆動開発アーキテクチャ
- [CLAUDE.md](../../CLAUDE.md): プロジェクト方針・規約
