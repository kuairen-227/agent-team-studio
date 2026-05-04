# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクトの目的

- 学習目的のプロジェクト。技術スタックやアーキテクチャは最新のベストプラクティスに沿うが、設計判断はユーザーが行い、技術的な内容を理解しながら進める
- AI駆動開発の実践。企画→要件定義→設計→開発→試験→改善→運用保守のサイクルをマネジメント業務含めて一気通貫でAIと協働して回す
- Claude は選択肢や根拠を提示して判断を仰ぐこと。勝手に決定せず、ユーザーの理解と意思決定を優先する（詳細: [principles §1](docs/principles/README.md)）

## プロジェクトの状況設定

学習プロジェクトだが、リアリティある開発プロセスを体験するため以下の仮想状況を設定している（[ADR-0002](docs/adr/0002-project-scenario.md)）：

- **シナリオ**: 社内新規事業として新プロダクトを立ち上げる
- **チーム**: PM 1人 + エンジニア 1人（エンジニアが AI と協働して開発）
- **制約**: 標準的な社内制約（クラウド承認制、セキュリティレビューあり、ただし柔軟性あり）

## 作業ディレクトリ

- **`_dev/`**: AI と人間の共有作業場所。下書き、検討メモ、一時ファイル等を配置する（`.gitignore` で追跡対象外）

## 文体規約

- 簡潔に書く。前置き・繰り返し・要約を省き、結論から述べる
- AI特有の冗長な表現（過剰な丁寧語、不要な言い換え、水増し的な修飾）を避ける
- ドキュメント・コミットメッセージ等、すべてのテキスト出力に適用する
- 詳細: [principles §6](docs/principles/README.md)

## 設計・開発原則

領域横断的な判断軸（ユーザー判断優先・本質志向・節度・MVP 整合・誠実さ・文体規約）と採用業界標準・横断的アンチパターンは [docs/principles/README.md](docs/principles/README.md) を SSoT とする。

CLAUDE.md は AI が常時参照する起動時ガイダンスとして要点を残し、principles が詳細・全体像を担う。各エージェント（`.claude/agents/*`）とスキル（`.claude/skills/*`）も principles を前提とする。

### 密結合の回避

ドキュメント・コメント・コードを問わず、過剰な相互参照・関連付けは避ける。参照は必要最小限に留め、密結合を生まない。

- ドキュメント間の参照は [ADR-0021](docs/adr/0021-doc-cross-reference-policy.md)（ハブ＆スポーク + 緩い水平参照）に従う。README をハブとし、双方向リンク・セクション精度の重複参照を作らない
- コードコメントは「リンク的説明」（他ファイルや他関数への参照）より、その箇所単独で意味が通る記述を優先する

## 主要コマンド

| コマンド | 説明 |
| --- | --- |
| `bun run lint` | Biome による静的解析（全ワークスペース、Turborepo 経由） |
| `bun run lint:fix` | Biome による lint・format の自動修正（全ワークスペース、Turborepo 経由） |
| `bun run lint:md` | Markdown の lint（markdownlint-cli2） |
| `bun run lint:secret` | 機密情報の検出（secretlint） |
| `bun run type-check` | TypeScript 型チェック（全ワークスペース、Turborepo 経由） |
| `bun run test` | テスト実行（全ワークスペース、Turborepo 経由） |
| `bun run build` | ビルド（依存順に全ワークスペース、Turborepo 経由） |

## コーディング規約

- **コミット**: conventional commits 形式 — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`。意味のある単位でコミットする
  - **Scope**: `type(scope):` 形式でスコープを付与する。プロダクト開発の進行に合わせて拡張する
  - 現在のスコープ: `adr`, `ci`, `project`（プロジェクト管理・設定）
  - パッケージ追加時はパッケージ名をスコープとして使用する

## プロジェクト管理

- **ブランチ戦略**: `docs/guides/branch-strategy.md` を参照。GitHub Flow ベースで `feat/`, `fix/`, `docs/`, `chore/` プレフィックスを使用
- **Issue テンプレート**: `.github/ISSUE_TEMPLATE/` に定義（feature, bug, task, decision）
- **PR テンプレート**: `.github/PULL_REQUEST_TEMPLATE.md` に定義
- **ADR**: `docs/adr/` に記録。意思決定は規模を問わず ADR として残す
- **ラベル**: タイプラベル（bug, enhancement, chore 等）を使用。ステータスは `status:blocked` のみ（ブロック時に付与）
