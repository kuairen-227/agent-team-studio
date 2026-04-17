# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクトの目的

- 学習目的のプロジェクト。技術スタックやアーキテクチャは最新のベストプラクティスに沿うが、設計判断はユーザーが行い、技術的な内容を理解しながら進める
- AI駆動開発の実践。企画→要件定義→設計→開発→試験→改善→運用保守のサイクルをマネジメント業務含めて一気通貫でAIと協働して回す
- Claude は選択肢や根拠を提示して判断を仰ぐこと。勝手に決定せず、ユーザーの理解と意思決定を優先する

## 作業ディレクトリ

- **`_dev/`**: AI と人間の共有作業場所。下書き、検討メモ、一時ファイル等を配置する（`.gitignore` で追跡対象外）

## コーディング規約

- **コミット**: conventional commits 形式 — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`。意味のある単位でコミットする
- **TypeScript**: strict モード有効、`any` の使用を避ける
- **インポート**: パッケージ間の依存には workspace プロトコル（`workspace:*`）を使用

## プロジェクト管理

- **ブランチ戦略**: `docs/guides/branch-strategy.md` を参照。GitHub Flow ベースで `feat/`, `fix/`, `docs/`, `chore/` プレフィックスを使用
- **Issue テンプレート**: `.github/ISSUE_TEMPLATE/` に定義（feature, bug, task, decision）
- **PR テンプレート**: `.github/PULL_REQUEST_TEMPLATE.md` に定義
- **ADR**: `docs/adr/` に記録。意思決定は規模を問わず ADR として残す
- **ラベル**: タイプラベル（bug, enhancement, chore 等）とフェーズラベル（`phase:planning` 等）を使用
