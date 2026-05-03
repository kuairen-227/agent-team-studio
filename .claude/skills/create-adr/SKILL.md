---
name: create-adr
description: プロジェクト規約に沿った ADR（Architecture Decision Record）を作成する。テンプレートに従って ADR ファイルを生成し、README の一覧表を更新する。
when_to_use: ユーザーが「ADR作って」「ADR書いて」「意思決定を記録して」「決定を残して」「ADR化して」などと言ったとき
argument-hint: "[title-or-topic]"
allowed-tools: Bash(gh issue view:*) Bash(gh issue list:*) Read Grep Edit Write Glob
---

# create-adr

プロジェクトの規約に従って ADR を作成する。
`$ARGUMENTS` から ADR のタイトルやトピックを判断する。

ADR テンプレート:

!`cat docs/adr/template.md`

既存 ADR 一覧:

!`cat docs/adr/README.md`

## 前提知識

- ADR は Michael Nygard の軽量フォーマットに基づく（ADR-0001 で決定済み）
- ADR の目的は「なぜその選択をしたか」を後から追跡可能にすること
- decision Issue で議論した結果を ADR に記録する、という流れが基本

## 手順

### 1. 次の ADR 番号の決定

上記の既存 ADR 一覧から最大の番号 + 1 を新しい ADR 番号とする。

### 2. 決定内容の把握

ユーザーの入力から以下を整理する:

- **何についての決定か**（タイトル）
- **なぜ決定が必要だったか**（Context）
- **検討した選択肢とその比較**
- **何を選んだか、なぜか**（Decision）
- **どういう影響があるか**（Consequences）

情報が不足している場合:

- 関連する Issue（特に decision ラベル付き）があれば `gh issue view` で内容を確認する
- コードベースや既存 ADR から関連する背景情報を収集する
- それでも不足する場合はユーザーに質問する

### 3. ADR ファイルの作成

上記のテンプレートの構造に従い作成する。

**ファイル名**: `docs/adr/NNNN-kebab-case-title.md`

- 番号は4桁ゼロ埋め（例: `0004`）
- タイトルは英語の kebab-case（例: `choose-database`, `adopt-monorepo`）

**Consequences の構造**: 既存 ADR に倣い、以下の3分類で記述する:

- **ポジティブ**: 良い影響
- **ネガティブ / リスク**: 悪い影響。リスクには必ず対策を併記する（→ 対策: ...）
- **中立**: どちらでもない影響

### 4. ADR 品質のセルフチェック

作成した ADR が以下の基準を満たしているか確認する:

- [ ] **Context が自己完結的か**: この ADR だけ読んで「なぜこの決定が必要だったか」がわかるか
- [ ] **Decision が明確か**: 何を選び、何を選ばなかったかが明確か
- [ ] **Consequences が正直か**: ネガティブな影響も隠さず書いているか
- [ ] **適切な粒度か**: 1つの ADR で1つの決定を扱っているか

### 5. README の一覧表を更新

`docs/adr/README.md` の ADR 一覧テーブルに新しいエントリを追加する。

- 日付は本日の日付を使用する
- ステータスは原則 `proposed`（ユーザーが accepted を指定した場合はそちらを使用）

### 6. 関連 Issue の処理

- 対応する decision Issue がある場合、ADR を作成した旨をユーザーに伝える（Issue のクローズはユーザー判断）
- ADR の中で Issue 番号に言及する場合は `#XX` 形式で参照する

### 7. ユーザーへの提示

作成した ADR の全文をユーザーに提示し、確認を求める。以下の点について特にフィードバックを促す:

- Context の記述が背景を正確に反映しているか
- Decision の記述が決定内容を正しく表しているか
- Consequences に漏れがないか

## Status の運用ルール

| ステータス | いつ使うか |
| ----------- | ----------- |
| `proposed` | 新規作成時のデフォルト。議論が必要な場合 |
| `accepted` | ユーザーが承認した場合。自明な決定は最初から accepted でもよい |
| `deprecated` | 決定が古くなり、もう従う必要がない場合 |
| `superseded by [NNNN](./NNNN-title.md)` | 新しい ADR で置き換えられた場合 |

## 注意点

横断軸（ユーザー判断優先・形式遵守の回避等）は [設計・開発原則](../../../docs/principles/README.md) を参照。

create-adr 固有の注意点:

- **既存 ADR との整合性**: 新しい ADR が既存の ADR と矛盾する場合は、既存 ADR のステータスを `superseded` に更新することを提案する
- **過度に形式的にしない**: 内容が薄いセクション（例: 自明な決定の Consequences）は簡潔でよい
- **「関連:」の列挙範囲**: 派生関係（`superseded by`・前提・補完）に限定する。本文外の周辺 ADR を網羅列挙しない（[ADR-0021](../../../docs/adr/0021-doc-cross-reference-policy.md) 許容パターン 2）
- **コミット**: CLAUDE.md のコミット規約に従い `docs(adr): NNNN タイトル` 形式を使用する
