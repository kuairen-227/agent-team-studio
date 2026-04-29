---
name: judge-dev-mode
description: Issue の内容から開発環境モード（solo / nested / split）を判断する。Issue 番号を引数に指定する。
when_to_use: ユーザーが「このIssue どの環境で進める？」「dev mode 判断して」「worktree 必要？」「#XX のモード判断して」などと言ったとき
argument-hint: "<issue-number>"
allowed-tools: Bash(gh issue view:*) Read Grep Glob
---

# judge-dev-mode

`$ARGUMENTS` で指定された Issue 番号の内容を読み取り、`docs/guides/worktree.md` のユースケース判断マトリクスに従って開発環境モードを推奨する。

判断と根拠の提示のみを行い、worktree の作成や DevContainer の起動は実行しない。

## 環境モードの定義

| ID | 名称 | 構成 |
| --- | --- | --- |
| solo | 単一 DevContainer | 1 ウィンドウ・1 コンテナ。worktree 不使用 |
| nested | `claude -w` | DevContainer 内で Claude Code が worktree を自動管理。tmux 多重化可（コンテナ内に worktree が入れ子） |
| split | `git worktree add` + 別 DevContainer | ホストで worktree 追加、各々を別 VS Code + 別 compose で reopen（コンテナごと分離） |

詳細は [docs/guides/worktree.md](../../../docs/guides/worktree.md)、構成は [docs/guides/devcontainer.md](../../../docs/guides/devcontainer.md) を参照。

## 手順

### 1. Issue の取得

```bash
gh issue view <issue-number>
```

以下を把握する:

- タイトル・本文（要件）
- ラベル（種別・フェーズ）
- 関連する Issue / ADR への参照
- マイルストーン

### 2. ユースケースのシグナル検出

Issue の本文・タイトル・ラベルから以下のシグナルを検出する。複数該当する場合は重い方（D > C > B > A の順）を優先する。

| シグナル例 | カテゴリ | 推奨 |
| --- | --- | --- |
| docs / README / ADR / lint / CI 設定 / Issue・PR テンプレート修正 | A 文書系 | solo |
| 単発バグ修正 / 型エラー / lint 修正 / 小規模リファクタ / フロント文言 / DB 無関係の API 追加 | B 軽量改修 | solo |
| 並行 spike / PoC / 読取中心の調査 / カラム追加程度の DB 変更 / E2E ログ確認 | C 軽量並行 | nested |
| DB 破壊的変更（DROP / ALTER COLUMN / RENAME / data migration / rollback 検証） | D 重量級 | split |
| Playwright の trace viewer / `--ui` デバッグ / 並行 E2E | D 重量級 | split |
| 大規模リファクタ（数十ファイル横断） / メジャーバージョンアップ / framework 移行 | D 重量級 | split |
| ホットフィックス（main 中断不可） / PR レビュー対応 + 別 Issue 並行 / 長時間 AI 委任 | D 重量級 | split |
| 機能追加 + DB スキーマ変更 / Playwright 実装 / BE+FE+DB 横断 / セキュリティパッチ | E 判断分岐 | 規模で判断 |

### 3. 判断フローの適用

シグナル検出と並行して、以下のフローを順に適用して最終モードを決める。

```text
1. 並行作業をしたい、または使い捨ての作業空間が欲しいか？
   YES → 2 へ
   NO  → solo

2. DB を破壊的に変更する？（DROP / ALTER COLUMN / 大規模 seed）
   YES → split（DB 隔離モードで起動）
   NO  → 3 へ

3. Playwright を trace viewer / 視覚デバッグ / 並行で回す？
   YES → split
   NO  → 4 へ

4. 複数の Claude セッションを同時に走らせたい？
   YES → nested（claude -w --tmux）
   NO  → solo
```

### 4. 推奨の出力

以下のフォーマットでユーザーに提示する。

````markdown
## Issue #XX: <タイトル>

**推奨モード**: <solo / nested / split>

### 判断根拠

- カテゴリ: <A 文書系 / B 軽量改修 / C 軽量並行 / D 重量級 / E 判断分岐>
- 検出したシグナル:
  - <シグナル 1>（Issue の該当記述: "..."）
  - <シグナル 2>
- 判断フローの分岐:
  - Q1 (main 中断可?): <YES/NO> → <次へ / 単>
  - Q2 (DB 破壊的?): <YES/NO> → ...
  - ...

### 推奨設定

- DB モード: <共有 / 隔離>
- ポート（worktree の場合の例）: `APP_PORT=3010`, `DB_PORT=5442`
- `DB_VOLUME`: <値>（隔離モード時のみ）

### 起動コマンド例

#### solo の場合

```bash
code .
# Reopen in Container
```

#### nested の場合

```bash
# DevContainer 内で
claude -w <branch-name> --tmux
```

#### split の場合

```bash
# ホスト側で
git worktree add ../agent-team-studio--<branch> -b <branch> origin/main
cd ../agent-team-studio--<branch>
cp .devcontainer/.env.example .devcontainer/.env
# .devcontainer/.env を編集（WORKTREE_ID / APP_PORT / DB_PORT / DB_VOLUME）
code .
# Reopen in Container
```

### 注意点

- <該当する場合のみ追記。例: 認証は claude-auth volume 共有のため再ログイン不要 / DB 隔離モードでは初期 seed が必要 / Playwright の依存パッケージは別途追加要 等>

### 確認事項

<Issue の記述だけでは判断できない要素があれば、ユーザーに確認する質問を列挙する>
````

## 注意点

- **判断材料の提示に徹する**: 最終的な判断はユーザーが行う。推奨は強制ではない
- **シグナルの根拠を明示する**: Issue 本文のどの記述から判断したかを引用する
- **曖昧な場合は確認する**: 判断に必要な情報が Issue に書かれていない場合、推奨を提示しつつ確認質問を併記する
- **複数モードの併用を検討する**: 1 つの Issue 内でフェーズによってモードを変える方が良い場合は、そのことも提案する（例: 設計フェーズは単、実装フェーズは WT）
- **既存判断軸の更新は別タスク**: マトリクスの更新が必要そうな新パターンに気づいた場合は、判断結果に併せて指摘するが、本スキルの中では更新しない
