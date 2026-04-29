# Git Worktree 運用ガイド

Claude Code の複数セッションで並行作業するための運用手順。

意思決定の背景は [ADR-0012](../adr/0012-git-worktree-parallel-sessions.md) と [ADR-0016](../adr/0016-devcontainer-integration.md) を参照。DevContainer の構成・DB モード切替・ポート割当は [devcontainer.md](./devcontainer.md) を参照。

## 3 つのモード

DevContainer × Worktree の利用パターンは 3 種類。

| ID | 構成 | 主な用途 |
| --- | --- | --- |
| solo | 単一 DevContainer。worktree 不使用 | 通常作業・軽量タスク |
| nested | DevContainer 内で `claude -w` | AI 並行・短命タスク・読取中心 |
| split | `git worktree add` + 別 DevContainer | DB 破壊的変更・並行 E2E・大規模リファクタ |

## 判断フロー

```text
1. 今の作業を止めずに別タスクを並行したいか？
   YES → 2 へ
   NO  → solo

2. DB を破壊的に変更する？（DROP / ALTER COLUMN / 大規模 seed）
   YES → split（DB 隔離モード）
   NO  → 3 へ

3. Playwright を trace viewer / 視覚デバッグ / 並行で回す？
   YES → split
   NO  → 4 へ

4. 複数の Claude セッションを同時に走らせたい？
   YES → nested（claude -w --tmux）
   NO  → solo
```

判断軸は **main 作業を止められるか / DB を破壊的に変更するか / Playwright で視覚デバッグや並行 E2E が必要か / 複数 Claude セッションを並行させたいか** の 4 つ。

Issue 番号から自動判断するには `/judge-dev-mode <番号>` を使う。

## ユースケース別マトリクス

### A. 文書・設定系 → solo

| ユースケース | 理由 |
| --- | --- |
| ADR / README / docs 更新 | ファイル変更のみ |
| ISSUE / PR テンプレート修正 | 同上 |
| Biome / lint / ts config 調整 | 単一コンテナで完結 |
| CI / GitHub Actions 修正 | DB / E2E 不要 |
| 依存パッケージのマイナー更新 | lockfile 更新のみ |

### B. コード改修系（軽量）→ solo

| ユースケース | 理由 |
| --- | --- |
| 単発バグ修正（DB 無関係） | スコープ小 |
| 型エラー / lint 修正 | 同上 |
| 小規模リファクタリング（単一 PR） | main を止めても支障なし |
| フロント style / copy 変更 | E2E 不要なら 1 コンテナで OK |
| 新規 API エンドポイント追加（DB 無関係） | 局所変更 |

### C. AI 並行・調査系 → nested

| ユースケース | 前提 | 理由 |
| --- | --- | --- |
| AI に複数 Issue を並行で回す | — | tmux で進行可視化、ライフサイクル自動化 |
| 短命 spike / PoC（捨てる前提） | — | 終了時自動クリーンアップ |
| 読取中心の調査・コード grep | — | 起動コスト最小 |
| カラム追加だけの軽微な DB 変更 | **DB 安全策**（後述）を適用 | DB 共有でも実害小 |
| Playwright 結果ログ・スクショ確認 | — | trace 詳細不要なら軽量 |
| AI レビュー対応中に別の小タスクを並行 | — | main の DevContainer を維持 |

> **DB 安全策**: nested は DB を main と共有するため、軽微な変更でも main DB を汚す可能性がある。`search_path` を worktree 名で切るか `CREATE DATABASE wt_<name>` を初期化スクリプトで作って分離すること。これが難しい場合は split を選ぶ。

### D. 重量級・隔離必須系 → split

| ユースケース | 理由 |
| --- | --- |
| DB 破壊的変更（DROP / ALTER COLUMN / RENAME） | main DB を汚染しない（DB 隔離モード使用） |
| マイグレーション rollback 検証 | 別 named volume で破壊実験可 |
| データダンプ復元・大規模 seed 検証 | volume 単位で差し替え |
| Playwright trace viewer / `--ui` デバッグ | dev server / artifact をフル分離 |
| 並行 E2E（複数 worktree で同時 Playwright） | ポート衝突回避は compose 任せ |
| 大規模リファクタリング（数十ファイル横断） | main を止めずに進める |
| メジャーバージョンアップ（framework, ORM 等） | 動作不安定期間を隔離 |
| ホットフィックス | main の中断不要 |
| PR レビュー対応 + 別 Issue 実装の同時並行 | VS Code を 2 ウィンドウで操作 |
| 長時間 AI 委任（数時間放置） | リソース完全分離で安定 |

### E. 判断分岐があるもの

| ユースケース | 分岐条件 | 推奨 |
| --- | --- | --- |
| 機能追加 + DB スキーマ変更 | 追加カラムのみ | nested（schema 分離） |
| 機能追加 + DB スキーマ変更 | テーブル変更・データ移行あり | split |
| Playwright を含む実装 | ログ確認のみ | nested |
| Playwright を含む実装 | 視覚デバッグ / CI 等価で回したい | split |
| BE + FE + DB を跨ぐ機能 | 単発・PR 1 本で済む規模 | solo |
| BE + FE + DB を跨ぐ機能 | 大規模・並行作業・破壊的変更含む | split |
| セキュリティパッチ適用 | 通常リリースで吸収可 | solo |
| セキュリティパッチ適用 | 緊急（main 中断したくない） | split |

## モード別の使い方

### solo

```bash
code .
# VS Code で「Reopen in Container」
claude
```

### nested（`claude -w`）

Claude Code v2.1.49+ のネイティブ Worktree 機能。`.claude/worktrees/<name>/` に worktree を作成し、その中で Claude セッションが起動する。ライフサイクルは自動管理（変更なし→自動削除、変更あり→keep/remove 確認）。

```bash
# DevContainer 内で
claude -w feat-auth          # 名前を指定
claude -w                    # 自動生成
claude -w feat-auth --tmux   # tmux ペインに配置
```

`.gitignore` 対象ファイル（`.env` 等）を worktree にコピーするには、リポジトリルートの `.worktreeinclude` に列挙する（`.gitignore` と両方に一致するもののみコピーされる）。`.env.example` は git 追跡対象なのでそもそも対象外。

```text
.env
.env.local
.devcontainer/.env
```

worktree 作成時にカスタム処理を実行したい場合は `.claude/settings.json` にフックを定義する。

```json
{
  "hooks": {
    "WorktreeCreate": [{
      "hooks": [{
        "type": "command",
        "command": "cd $WORKTREE_PATH && bun install"
      }]
    }]
  }
}
```

### split（`git worktree add` + 別 DevContainer）

ディレクトリ配置を明示的に制御し、コンテナごと完全分離する。VS Code は 2 ウィンドウ並べて使う（マルチルートワークスペースで 1 ウィンドウ横断も可）。

ディレクトリ構成:

```text
/workspaces/
  agent-team-studio/              # メインツリー
  agent-team-studio--feat-auth/   # split worktree
  agent-team-studio--fix-login/   # split worktree
```

基本コマンド:

```bash
# 作成（新規ブランチ / 既存ブランチ）
git worktree add ../agent-team-studio--feat-auth -b feat/auth
git worktree add ../agent-team-studio--feat-auth feat/auth

# 一覧 / 削除 / 整理
git worktree list
git worktree remove ../agent-team-studio--feat-auth
git worktree prune
```

DevContainer での起動:

```bash
cd ../agent-team-studio--feat-auth
cp .devcontainer/.env.example .devcontainer/.env
# .env を編集（WORKTREE_ID / APP_PORT / DB_PORT / DB_VOLUME）
code .
# Reopen in Container → コンテナ内で bun install
```

## Subagent の Worktree 分離

スキルやエージェントのフロントマターに `isolation: worktree` を指定すると、subagent が独立した worktree で実行される。

```yaml
---
name: parallel-implementer
isolation: worktree
---
```

セッション中に「use worktrees for your agents」と指示しても有効化できる。

## 動作互換性

| コンポーネント | 動作 | 備考 |
| --- | --- | --- |
| スキル / エージェント / 設定 (`.claude/`) | OK | git 追跡 |
| Husky pre-commit hooks | OK | `.husky/` も git 追跡 |
| `gh` CLI / git 操作 | OK | worktree も通常の git リポジトリ |
| プロジェクトメモリ | **独立** | パスベースで分離 |
| `node_modules/` | **独立** | worktree ごとに `bun install` 必要 |
| `_dev/` | **独立** | `.gitignore` 対象 |

`.claude/settings.json` の `statusLine.command` はメインツリーへの絶対パスを参照している。スクリプト自体はパス非依存だが、メインツリーが移動・削除されると壊れる。

## 補足ルール

- **認証は共有**: すべての DevContainer で `claude-auth` named volume をマウント（再ログイン不要）
- **nested の DB 安全策**: カテゴリ C の DB 改修で nested を選ぶときは前述の前提（`search_path` 分離 or `CREATE DATABASE wt_<name>`）を必ず適用
- **split のリソース上限**: 同時 2 並行までを目安にする（`docker compose stop` で休眠も活用）
- **Playwright の `PORT` / `APP_URL`**: `.devcontainer/.env` で worktree ごとに切替（[devcontainer.md](./devcontainer.md) 参照）

## 注意事項

- 同じブランチを複数の worktree で同時にチェックアウトできない
- worktree 間でファイルを直接コピーしない（git 経由でやり取り）
- `.claude/worktrees/` は `.gitignore` 設定済み（nested 利用時の前提）
