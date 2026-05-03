---
name: write-product-doc
description: docs/product/ 配下のドキュメントを作成・更新する。配置ガイドラインを遵守し、技術要素の混入を防ぐ。
when_to_use: ユーザーが「プロダクトドキュメント書いて」「ユーザーストーリー書いて」「画面フロー書いて」「テンプレート仕様書いて」「product doc 書いて」「プロダクト仕様更新して」などと言ったとき
argument-hint: "[new|update] [対象ファイル名 or トピック]"
allowed-tools: Read Grep Glob Edit Write Bash(git diff:*) Bash(git log:*)
---

# write-product-doc

`docs/product/` 配下のドキュメントを作成・更新する。`$ARGUMENTS` から対象ファイルと操作を判断する。

配置ガイドライン:

!`cat docs/product/README.md`

用語集:

!`cat docs/product/glossary.md`

## 手順

### 1. 対象の特定

`$ARGUMENTS` から新規作成か既存更新かを判定し、対象ファイルを特定する。

| パターン | 操作 |
| --- | --- |
| `new ...` / 存在しないファイル名 | 新規作成 |
| `update ...` / 既存ファイル名 | 既存ファイルの更新 |

既存ファイルの更新時は、必ず現在の内容を Read で確認してから編集する。

### 2. 書く前のチェックリスト

ドキュメントの内容を書く前に、以下を確認する:

- [ ] JSON Schema 定義を含まないこと（`"type":`, `"required":`, `"properties":`, `$schema` を使わない）
- [ ] enum リテラルの列挙を含まないこと（`"value1" | "value2"` 形式を使わない。自然言語で説明する）
- [ ] API エンドポイント定義を含まないこと
- [ ] DB テーブル設計・JSONB 構造を含まないこと
- [ ] LLM パラメータ（temperature, max_tokens 等）を含まないこと
- [ ] 上記に該当する情報は `docs/design/` への参照リンクに置き換えること

### 3. システムプロンプトの出力フォーマット

テンプレート仕様でシステムプロンプトを書く場合、出力フォーマットは:

- 自然言語で構造の概要を説明する（フィールド名と意味のリスト）
- `docs/design/templates/` の対応スキーマへの参照リンクを付ける
- 「実行時にはスキーマ定義をこの位置に展開してプロンプトに含める」旨を注記する
- JSON ブロックをインライン定義しない

### 4. ドキュメントの作成・更新

上記チェックリストを遵守してドキュメントを作成・更新する。本ステップは **作成判断時の指針**（リンクを書くか否か）。

- 用語は `docs/product/glossary.md` に準拠する
- `docs/design/` への参照は [ADR-0021](../../../docs/adr/0021-doc-cross-reference-policy.md) の許容パターン（基盤ドキュメント参照・SSoT 接続）に該当する場合のみ追加する

### 5. 書いた後のコンプライアンスチェック

作成・更新したドキュメントを Grep で検査する:

1. `"type":` / `"required":` / `"properties":` / `\$schema` → JSON Schema の混入
2. `" \| "` パターン（パイプ区切りの enum リテラル）→ 型定義の混入
3. `temperature` / `max_tokens` / `model:` → LLM パラメータの混入

違反が見つかった場合は、該当箇所を自然言語の説明 + design/ 参照リンクに修正する。

### 6. 書いた後の参照チェック（[ADR-0021](../../../docs/adr/0021-doc-cross-reference-policy.md)）

ステップ 4 が作成判断、本ステップは **書いた後の検証**。ADR・基盤 doc（glossary / principles / 各 README）への参照は本手順の対象外（許容パターン 3 として常時 OK）。横方向の通常 doc への参照に対し以下を確認する。

- 参照リンクを書いた場合、リンク先のファイルとアンカーが実在するか Glob / Read で確認する
- 双方向リンクが生まれていないか確認し、生まれていれば SSoT 側に寄せて片方向化する
- § アンカー精度の参照は SSoT 側から **初出 1 回のみ** とする。同一 doc 内で複数回参照していれば 1 回に集約する
- 「関連ドキュメント」セクションを設けた場合、README 経由で到達可能な doc は列挙から外す

## 注意点

- このスキルは `docs/product/` 配下のみを対象とする。対応する `docs/design/` 側も更新が必要な場合は `write-design-doc` スキルを併用する
- 新しい用語を導入する場合は `docs/product/glossary.md` への追加も行う
- テンプレート仕様を新規作成する場合、対応する I/O スキーマが `docs/design/templates/` に必要。存在しない場合はユーザーに確認する
