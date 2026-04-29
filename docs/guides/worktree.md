# Git Worktree 運用ガイド

Claude Code の複数セッションで並行作業するための Git Worktree 運用手順。

意思決定の背景は [ADR-0012](../adr/0012-git-worktree-parallel-sessions.md) と [ADR-0016](../adr/0016-devcontainer-integration.md) を参照。DevContainer の構成・DB モード切替・ポート割当は [devcontainer.md](./devcontainer.md) を参照。

## 概要

Git Worktree を使うと、1つのリポジトリから複数の作業ディレクトリを作成できる。ブランチの切り替えなしに複数の Issue を並行して作業できる。

DevContainer と組み合わせる場合、利用パターンは 3 種類ある：

| ID | 名称 | 構成 |
| --- | --- | --- |
| 単 | 単一 DevContainer | 1ウィンドウ・1コンテナ。worktree 不使用 |
| w | `claude -w` | DevContainer 内で Claude Code が worktree を自動管理。tmux 多重化可 |
| WT | `git worktree add` + 別 DevContainer | ホストで worktree 追加、各々を別 VS Code + 別 compose で reopen |

ユースケースごとの選択は後述のマトリクスに従う。

## Claude Code ネイティブ Worktree（推奨）

Claude Code v2.1.49+ のネイティブ Worktree サポートを使う。ライフサイクルが自動管理される。

### 起動

```bash
# 名前を指定して起動
claude -w feat-auth

# 名前を省略（自動生成）
claude -w

# tmux セッションと統合
claude -w feat-auth --tmux
```

`.claude/worktrees/<name>/` に worktree が作成され、そのディレクトリで Claude Code セッションが開始される。

### ライフサイクル

1. **起動時**: worktree を自動作成し、デフォルトリモートブランチから分岐
2. **実行中**: 独立したブランチで作業
3. **完了時**:
   - 変更なし → 自動削除
   - 変更あり → keep/remove を確認（keep 選択時は後から再開可能）

### 環境ファイルの引き継ぎ

`.gitignore` 対象のファイル（`.env` 等）を worktree にコピーするには、リポジトリルートに `.worktreeinclude` を作成する:

```text
.env
.env.*
```

`.worktreeinclude` と `.gitignore` の両方に一致するファイルのみがコピーされる。

### WorktreeCreate フック

worktree 作成時にカスタム処理を実行するには、`.claude/settings.json` にフックを定義する:

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

## Subagent の Worktree 分離

スキルやエージェントのフロントマターに `isolation: worktree` を指定すると、subagent が独立した worktree で実行される:

```yaml
---
name: parallel-implementer
isolation: worktree
---
```

セッション中に「use worktrees for your agents」と指示しても有効化できる。

## 手動操作

ネイティブ機能ではなく `git worktree` を直接使う場合の手順。ディレクトリ配置を明示的に制御したい場合や、長期間の作業ディレクトリを維持したい場合に使う。

### ディレクトリ構成

worktree はリポジトリの外側に配置する。

```text
/workspaces/
  agent-team-studio/              # メインの作業ツリー（main ブランチ）
  agent-team-studio--feat-auth/   # worktree: 認証機能の作業
  agent-team-studio--fix-login/   # worktree: ログイン修正
```

### 基本コマンド

```bash
# 新しいブランチを作って worktree を作成
git worktree add ../agent-team-studio--feat-auth -b feat/auth

# 既存ブランチから worktree を作成
git worktree add ../agent-team-studio--feat-auth feat/auth

# 一覧表示
git worktree list

# 削除（マージ後）
git worktree remove ../agent-team-studio--feat-auth

# 不要な worktree の一括整理
git worktree prune
```

### 手動 worktree での作業開始

```bash
cd ../agent-team-studio--feat-auth
bun install
claude  # Claude Code セッションを起動
```

## Claude Code の動作互換性

worktree 環境での各コンポーネントの動作状況:

| コンポーネント | 動作 | 備考 |
| --- | --- | --- |
| スキル (`.claude/skills/`) | OK | git 追跡。相対パスも worktree ルートから解決される |
| エージェント (`.claude/agents/`) | OK | git 追跡 |
| 設定 (`.claude/settings.json`) | OK | git 追跡 |
| Husky pre-commit hooks | OK | `.husky/` も git 追跡 |
| `gh` CLI / git 操作 | OK | worktree も通常の git リポジトリとして動作 |
| プロジェクトメモリ | **独立** | パスベースで分離される。worktree ごとに別のメモリ空間 |
| `node_modules/` | **独立** | `.gitignore` 対象。worktree ごとに `bun install` が必要 |
| `_dev/` | **独立** | `.gitignore` 対象。worktree 間で共有されない |

### 注意: statusLine の絶対パス

`.claude/settings.json` の `statusLine.command` がメインツリーへの絶対パスを参照している。スクリプト自体はパス非依存のため動作するが、メインツリーが移動・削除されると壊れる。

## 並行作業の典型パターン

### ネイティブ worktree

```bash
# Terminal 1: メインツリーでタスク管理・レビュー
claude

# Terminal 2: feat/auth の実装
claude -w feat-auth

# Terminal 3: fix/login の修正
claude -w fix-login
```

### 手動 worktree

```bash
# Terminal 1: メインツリー（main）でタスク管理・レビュー
cd /workspaces/agent-team-studio && claude

# Terminal 2: worktree で feat/auth の実装
cd /workspaces/agent-team-studio--feat-auth && claude

# Terminal 3: worktree で fix/login の修正
cd /workspaces/agent-team-studio--fix-login && claude
```

## VS Code での利用

worktree を VS Code で開けば、Git 統合（差分表示・ステージング・コミット）は通常通り使える。worktree 内に `.git` ファイル（メインリポジトリへのポインタ）が作られるため。

```bash
code ../agent-team-studio--feat-auth
```

メインツリーと worktree を1つのウィンドウで同時に見たい場合は、マルチルートワークスペースとして両方を追加できる。

## 注意事項

- 同じブランチを複数の worktree で同時にチェックアウトできない
- 各 worktree で `bun install` を実行して依存をインストールすること
- worktree 内の `node_modules/` や `.turbo/` はメインツリーとは独立
- worktree 間でファイルを直接コピーしない（git 経由でやり取りする）
- `_dev/` は `.gitignore` 対象のため worktree 間で共有されない
- ネイティブ worktree を使う場合、`.gitignore` に `.claude/worktrees/` を追加する

## ユースケース別の使い分け

修正の種類に応じて 3 パターン（単 / w / WT）から選ぶ。判断軸は **main 作業を止められるか / DB を破壊的に変更するか / Playwright で視覚デバッグや並行 E2E が必要か / 複数 Claude セッションを並行させたいか**。

### A. 文書・設定系（迷い無し）

| ユースケース | 推奨 | 理由 |
| --- | --- | --- |
| ADR / README / docs 更新 | 単 | ファイル変更のみ |
| ISSUE / PR テンプレート修正 | 単 | 同上 |
| Biome / lint / ts config 調整 | 単 | 単一コンテナで完結 |
| CI / GitHub Actions 修正 | 単 | DB / E2E 不要 |
| 依存パッケージのマイナー更新 | 単 | lockfile 更新のみ |

### B. コード改修系（軽量）

| ユースケース | 推奨 | 理由 |
| --- | --- | --- |
| 単発バグ修正（DB 無関係） | 単 | スコープ小 |
| 型エラー / lint 修正 | 単 | 同上 |
| 小規模リファクタリング（単一 PR） | 単 | main を止めても支障なし |
| フロント style / copy 変更 | 単 | E2E 不要なら 1 コンテナで OK |
| 新規 API エンドポイント追加（DB 無関係） | 単 | 局所変更 |

### C. AI 並行・調査系（`claude -w` が活きる）

| ユースケース | 推奨 | 理由 |
| --- | --- | --- |
| AI に複数 Issue を並行で回す | w | tmux で進行可視化、ライフサイクル自動化 |
| 短命 spike / PoC（捨てる前提） | w | 終了時自動クリーンアップが効く |
| 読取中心の調査・コード grep | w | 起動コスト最小 |
| カラム追加だけの軽微な DB 変更（schema 分離前提） | w | DB 共有でも実害小 |
| Playwright 結果ログ・スクショ確認 | w | trace 詳細不要なら軽量 |
| AI レビュー対応中に別の小タスクを並行 | w | main の DevContainer を維持したまま |

### D. 重量級・隔離必須系（`git worktree add` 必須）

| ユースケース | 推奨 | 理由 |
| --- | --- | --- |
| DB 破壊的変更（DROP / ALTER COLUMN / RENAME） | WT | main DB を汚染しない（DB 隔離モード使用） |
| マイグレーション rollback 検証 | WT | 別 named volume で破壊実験可 |
| データダンプ復元・大規模 seed 検証 | WT | volume 単位で差し替え |
| Playwright trace viewer / `--ui` デバッグ | WT | dev server / artifact をフル分離 |
| 並行 E2E（複数 worktree で同時 Playwright） | WT | ポート衝突回避は compose 任せ |
| 大規模リファクタリング（数十ファイル横断） | WT | main を止めずに進める |
| メジャーバージョンアップ（framework, ORM 等） | WT | 動作不安定期間を隔離 |
| ホットフィックス（main の作業中に緊急対応） | WT | main の中断不要 |
| PR レビュー対応 + 別 Issue 実装の同時並行（視覚編集） | WT | VS Code を 2 ウィンドウで操作 |
| 長時間 AI 委任（数時間放置するタスク） | WT | リソース完全分離で安定 |

### E. 判断分岐があるもの

| ユースケース | 分岐条件 | 推奨 |
| --- | --- | --- |
| 機能追加 + DB スキーマ変更 | 追加カラムのみ | w（schema 分離） |
| 機能追加 + DB スキーマ変更 | テーブル変更・データ移行あり | WT |
| Playwright を含む実装 | ログ確認のみ | w |
| Playwright を含む実装 | 視覚デバッグ / CI 等価で回したい | WT |
| BE + FE + DB を跨ぐ機能 | 単発・PR 1 本で済む規模 | 単 |
| BE + FE + DB を跨ぐ機能 | 大規模・並行作業・破壊的変更含む | WT |
| セキュリティパッチ適用 | 通常リリースで吸収可 | 単 |
| セキュリティパッチ適用 | 緊急（main 中断したくない） | WT |

### 判断フロー

```text
1. main の作業を中断・コミットして切替できるか？
   YES → 単で十分
   NO  → 2 へ

2. DB を破壊的に変更する？（DROP / ALTER COLUMN / 大規模 seed）
   YES → WT（DB 隔離モードで起動）
   NO  → 3 へ

3. Playwright を trace viewer / 視覚デバッグ / 並行で回す？
   YES → WT
   NO  → 4 へ

4. 複数の Claude セッションを同時に走らせたい？
   YES → w（claude -w --tmux）
   NO  → 単
```

### 補足ルール

- w の DB 安全策: 軽微な変更でも main DB を汚す可能性があるなら、`search_path` を worktree 名で切るか `CREATE DATABASE wt_<name>` を初期化スクリプトで作る
- WT のリソース上限: 同時 2 並行までを目安にする（compose stop で休眠も活用）
- 認証は常に共有: すべての DevContainer で `claude-auth` named volume をマウント
- Playwright の `PORT` / `APP_URL`: `.devcontainer/.env` で worktree ごとに切替（`devcontainer.md` 参照）
