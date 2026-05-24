# manage-issue

GitHub Issue / マイルストーンを横断的に管理する PM 視点のスキル。分析（進捗・優先順位・スコープ）と、合意後の構造化操作（一括起票・親子関係登録・マイルストーン更新）を担う。

スキル本体の仕様は [SKILL.md](./SKILL.md) を参照。本 README は人間ユーザー向けの使い方ガイド。

## いつ使うか

- 「次なにやる？」「進捗確認して」「優先順位つけて」「バックログ整理して」など全体俯瞰系の問いかけ
- Issue セットを複数件 + 親子関係 (sub_issues) 付きでまとめて起票したい
- マイルストーン description やトラッカコメントを操作したい

**使わない場面**:

- **単発 Issue 1 件のみ・親子なし** → `/create-issue` を使う
- 特定 Issue を読んで作業計画＋実装まで進める → `/process-issue`
- 開発環境モード (solo/nested/split) の判断 → `/judge-dev-mode`

## サブコマンド一覧

3 つに集約されている。`prioritize` / `risk` は旧仕様の引数名で、それぞれ `plan` / `status` に吸収済み（旧引数も後方互換で受け付ける）。

| 引数 | 用途 | 出力の主な構成 |
| --- | --- | --- |
| `status` / 省略 | 進捗概況（旧 `risk` を吸収） | サマリ → マイルストーン進捗表 → blocked/停滞 Issue → 直近クローズ → 観察と推奨次アクション |
| `plan` / `prioritize` | 計画と優先順位 | 順序付きリスト（先頭固定） → 判断軸の明示 → 補足・除外理由 → 承諾の問いかけ |
| `scope` | MVP スコープ整合性 | 判定表 → スコープ外候補 → スコープクリープ観察 |

## 使い方

```text
/manage-issue                    # = status
/manage-issue plan               # 計画と優先順位
/manage-issue scope              # MVP スコープ整合性
```

出力の冒頭に **「サブコマンドは X として処理します」のエコー** が必ず入る。想定と違う subcommand に解釈されている場合は即座に検知できるため、エコーが見当たらない・違うものになっている時は止めて修正を依頼するとよい。

未知の引数（typo 含む）は status にフォールバックせず、解釈候補を提示してユーザーに確認する設計。

## 分析 → 合意 → 操作のフロー

```text
1. 分析（status / plan / scope）
   ↓ 結果と推奨アクションを提示
2. ユーザーが操作内容を承諾
   ↓
3. 構造化操作（以下のいずれか・複数）
   - 一括起票（複数 Issue を順次作成）
   - 親子関係 (sub_issues) 登録
   - マイルストーン description 更新
   - トラッカ Issue にコメント追加
```

**分析のみで完結し、勝手に Issue を作成・編集することはない**。Step 3 の操作はユーザー承諾後にのみ実行する。

## ワークフロー例

### 新フェーズ開始時の俯瞰

```text
/manage-issue status      # 何が残っているか俯瞰
/manage-issue plan        # 着手順序と直近セットを決める
```

### Issue セット一括起票

```text
ユーザー: 「v0.6 で 5 件起票して、トラッカ #234 配下に sub_issue 登録して」
→ Issue 設計（タイトル・本文・親子関係・ラベル）を表で提示
→ ユーザーが 1 回でまとめて承諾
→ 一括起票 → sub_issues API で親子登録 → 検証（件数一致確認）
```

### MVP スコープのチェック

```text
ユーザー: 「最近の起票が MVP スコープを越えていないか確認して」
→ /manage-issue scope
→ 各 open Issue を ADR-0005 と照合 → 「あると便利 vs 必須」判定
```

## 関連スキル

- [`/create-issue`](../create-issue/SKILL.md) — 単発 Issue 1 件の起票（本スキルが Issue 規約を参照する SSoT）
- [`/process-issue`](../process-issue/SKILL.md) — 特定 Issue の作業計画と実装
- [`/judge-dev-mode`](../judge-dev-mode/SKILL.md) — 開発環境モード判断

## よくある落とし穴

- **task list `- [ ] #N` だけでは親子関係にならない**: GitHub のデータモデル上の sub_issues は専用 API で登録する必要がある。task list は見た目だけ
- **単発 Issue で本スキルを呼ばない**: `/create-issue` に委譲する
- **`gh api` は `:owner/:repo` 形式で書く**: literal でリポジトリ名を書くと毎回パーミッションプロンプトが出る（settings.json の Bash 許可パターンに一致しないため）
