# ブランド

Agent Team Studio が「何を信じ、どう振る舞うか」を定義する。視覚的な装飾ではなく、体験の一貫性で示すブランドアイデンティティ。

UI 実装に落ちる詳細は [design/ui-patterns.md](../design/ui-patterns.md) を参照。前提は [ADR-0005 MVP スコープ](../adr/0005-mvp-scope.md) と [user-stories.md](./user-stories.md)。

## 1. ブランド軸

**AI を魔法に見せず、進捗・限界・失敗を誠実に見せる。ユーザーの判断を奪わず、判断材料を提供する。**

具体的な振る舞いに翻訳すると以下:

- **進捗を隠さない**: 何が動いているかをリアルタイムに可視化する（[ui-patterns.md §2-1](../design/ui-patterns.md)）
- **失敗を隠さない**: partial-failure を通常状態と同等に並べる（[ui-patterns.md §2-2](../design/ui-patterns.md), [agent-execution.md §6](../design/agent-execution.md)）
- **判断を奪わない**: AI の出力を「正解」として提示せず、ユーザーが評価できる素材として並べる（[user-stories.md US-4](./user-stories.md#us-4-統合結果を閲覧しエクスポートする)）
- **過剰演出をしない**: スピナー単独表示・励まし文言・装飾的アニメーションを避ける

ターゲットユーザー（PdM・エンジニア / [ADR-0004](../adr/0004-target-users.md)）が AI 出力を批判的に評価できる環境を作ることが、本プロダクトの存在意義。

## 2. ボイス & トーン

**技術者の同僚として淡々と事実を伝える。**

### 口調規約

| 方針 | 良い例 | 避けたい例 |
| --- | --- | --- |
| 事実を述べる | 「実行中」「完了」「失敗（理由: タイムアウト）」 | 「処理を頑張っています」 |
| 感情表現を入れない | 「データを取得できませんでした」 | 「申し訳ございません、取得に失敗しました」 |
| 催促しない | 「テンプレートを選択してください」（必須項目の説明として） | 「お忘れではありませんか?」 |
| 責めない | 「URL の形式が不正です（例: <https://example.com>）」 | 「正しく入力してください」 |

### 適用範囲

- UI 文言（状態ラベル・エラーメッセージ・空状態・ボタンラベル）
- API レスポンスの `message` フィールド（[api-design.md](../design/api-design.md) が SSoT）
- README・ドキュメント本文
- コミットメッセージ・PR タイトル

UI とドキュメントで口調が割れないよう、すべての文言生成箇所で本規約を適用する。

## 3. 視覚アイデンティティ方針

学習プロジェクトの節度（[ADR-0005 ロックイン回避](../adr/0005-mvp-scope.md)）として、独自の視覚 VI は作らない。

- shadcn/ui デフォルトテーマ（`slate` ベース）を採用
- ロゴは「Agent Team Studio」のテキストのみ。独自シンボル不要
- カスタムカラーはステータスバッジの 4 色のみ（[ui-patterns.md §6.1](../design/ui-patterns.md)）

ブランドは見た目ではなく、§1 ブランド軸と §2 ボイスの一貫性で示す。

## 4. 関連ドキュメント

- [user-stories.md](./user-stories.md) — US-1〜US-5 受入基準（ブランド軸が UX に翻訳される）
- [glossary.md](./glossary.md) — UI 表記・ステータス語彙の SSoT
- [ui-patterns.md](../design/ui-patterns.md) — ブランド軸の UI 実装ガイド
- [api-design.md](../design/api-design.md) — API メッセージの SSoT
