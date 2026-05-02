# UI パターン & デザイン原則

UI/UX 面の設計指針。立脚する設計原則・プロジェクト固有の判断軸・状態パターン・グローバルナビ・shadcn/ui コンポーネントマッピング・Tailwind トークン・アクセシビリティ・URL ルーティングを定める。本 doc は実装上の迷い所の判断基準を提供し、Figma 等の編集資産を持たない代わりに Markdown で一元管理する。

前提:

- [ADR-0005 MVP スコープ](../adr/0005-mvp-scope.md) — Hero UC・成功基準・スコープ外
- [ADR-0008 技術スタック](../adr/0008-tech-stack.md) — React + Vite / shadcn/ui / Tailwind v4
- [brand.md](../product/brand.md) — ブランド軸・ボイス&トーン（本 doc の上位思想）
- [screen-flow.md](../product/screen-flow.md) — 画面遷移（本 doc は UX 構造の技術的受け皿）

## 1. 立脚する設計原則

業界標準として以下 3 体系を意思決定の根拠とする。本 doc 内の判断は、これらと §2 のプロジェクト固有判断軸の組み合わせで導かれる。

| 体系 | 焦点 | 主に効く節 |
| --- | --- | --- |
| Nielsen 10 ユーザビリティヒューリスティック | システム状態可視化、エラー処理、認識の支援 | §3 状態パターン |
| Laws of UX | 待ち時間、認知負荷、慣習 | §3 §4 §6 |
| WCAG 2.1 POUR | アクセシビリティ AA 相当 | §7 |

加えて、上位思想として [brand.md](../product/brand.md) のブランド軸（誠実さ・判断材料の提供）が全体を貫く。各原則の出典は [§10 参考文献](#10-参考文献) を参照。

## 2. 本プロジェクト固有の判断軸

§1 の業界標準とブランド軸から派生する、意思決定時の優先順位（上から降順、矛盾時は上位を取る）。

1. **進捗の可視化を最優先** — Hero UC（30 分以内の競合比較）の体感価値の核（[ADR-0005](../adr/0005-mvp-scope.md), [US-3](../product/user-stories.md#us-3-エージェントの進捗をリアルタイムで見る) / Nielsen #1 Visibility / Doherty Threshold）
2. **partial failure に優しい** — 失敗観点を全成功と等価に扱い、別レイアウトに追いやらない（[agent-execution.md §6](./agent-execution.md), [US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) / Tesler's Law / Peak-End Rule）
3. **テキスト主体** — LLM 出力の可読性 > 装飾。マトリクスもグラフ化せず Markdown を主成果物とする（F-pattern）
4. **ノンブロッキング** — 実行はバックグラウンド継続前提。モーダルは破壊的操作のみ（Feedback Loop）
5. **節度** — shadcn/ui デフォルトを尊重、独自トークンは最小限（[ADR-0005 ロックイン回避](../adr/0005-mvp-scope.md) / Jakob's Law / Aesthetic-Usability Effect）
6. **キーボードファースト** — 反復利用のコスト削減。focus リングは shadcn/ui デフォルトを保持（[ADR-0004](../adr/0004-target-users.md) / Fitts's Law / WCAG Operable）
7. **再現性・持ち出しやすさ** — Result.structured を SSoT とし、UI とエクスポートを派生物にする

## 3. 状態パターン

各画面の loading / empty / error / partial-failure の表示ルールを統一する。語彙は [glossary.md ステータスラベル](../product/glossary.md) と整合する（口調規約は brand.md による）。

### 3.1 loading

- 初回ロードは要素と同形の `Skeleton` を表示する（Skeleton screen による perceived performance）
- アクション後の短時間待ちはボタンを `disabled` 化しラベル切替（「実行中…」等）
- 進捗画面の WS 接続待ちは「接続中…」のテキストのみ
- スピナー単独表示は使わない（**テキスト主体** の判断軸と矛盾）

### 3.2 empty

- 履歴 0 件は中央寄せで「まだ実行がありません」+ テンプレート一覧へ戻る導線
- 1 行のテキスト + 次アクションのリンク 1 つで構成、イラストは持たない（Recognition over Recall）
- MVP では履歴のみ想定（テンプレートはシードで常に 1 件以上）

### 3.3 error

実行処理の失敗は WS 経由で届くため、REST のエラー表示と分けて扱う。

| 起源 | 表現 | コンポーネント |
| --- | --- | --- |
| REST `validation_error` (400) | フォーム項目直下に inline メッセージ。`details[].field` でマッピング | フォーム要素直下のテキスト |
| REST `not_found` (404) | 画面中央に Alert + 一覧画面へのリンク | `Alert` (variant: destructive) |
| REST `internal_error` (500) | Toast で一時表示、ユーザー操作は継続可能 | `Toast` |
| 接続レベル WS エラー（`4404` / `1011`） | 進捗画面に Alert + 「履歴一覧から確認」導線（[再接続ポリシー](./websocket-design.md) のとおり自動再接続なし） | `Alert` (variant: destructive) |

文言は [api-design.md](./api-design.md) の `message` をそのまま表示する。UI 側で再構成しない（SSoT 原則）。

### 3.4 partial-failure

[agent-execution.md §6](./agent-execution.md) の `Result.structured.missing[]` に格納される観点を、結果マトリクス内に専用セクションとして提示する。

- マトリクス本体（行 = 観点、列 = 競合）からは失敗観点の行を除外せず、空セルに `missing` ラベルを表示
- マトリクス下部に「未取得観点」セクションを配置し、`missing[].perspective` と `reason`（`agent_failed` / `insufficient_evidence`）を列挙
- Markdown エクスポートも同構造（UI とエクスポートで構造を二重化しない）
- `agent:status status="failed"` の `reason`（`llm_error` / `output_parse_error` / `timeout` / `internal_error`）は進捗画面のステータスバッジに併記、結果画面では集約された `missing[].reason` のみ扱う
- 統合エージェント失敗時（`error_message: "integration_failed"`）は Result が未作成のため、各 `AgentExecution.output` を観点別カードで表示する（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする)）

## 4. グローバルナビ方針

グローバルナビの配置方針を本節で確定する（[screen-flow.md](../product/screen-flow.md) の画面構成を前提）。

### 採用方針: ヘッダー固定

ユーザーは他プロダクトでヘッダー固定ナビに慣れている（Jakob's Law）。慣習に従うことで学習コストをかけない。

```text
┌─────────────────────────────────────────────┐
│ Agent Team Studio   テンプレート一覧 / 履歴一覧 │  ← header (sticky top)
├─────────────────────────────────────────────┤
│                                              │
│  メインコンテンツ                             │
│                                              │
└─────────────────────────────────────────────┘
```

- 左にプロダクト名、右に「テンプレート一覧」「履歴一覧」のリンク 2 つを並べる
- ヘッダーは `sticky top-0` で常時可視。進捗画面では縦スペースを最大化するため、ヘッダー以外の固定要素を持たない
- ヘッダーの実装位置は `apps/web/src/components/AppHeader.tsx`（暫定）。`features/` 配下ではなく共通コンポーネントとして配置する（[architecture.md フロントエンド](./architecture.md) の昇格ルール）

### 不採用案

| 案 | 不採用理由 |
| --- | --- |
| サイドバー固定 | 画面 5 種に対し過大。進捗画面の縦長コンテンツ（出力ストリーミング）と相性が悪い |
| 画面単位のリンク（ヘッダーなし） | 履歴 → 結果 → テンプレート一覧 のような横断導線が冗長になる |
| ハンバーガー + Drawer | MVP のナビ項目 2 個に対し過剰。**節度** の判断軸と矛盾 |

### モバイル対応

[ユーザーストーリー Non-goals](../product/user-stories.md#non-goalsmvp-で意図的に含めないもの) のとおりモバイル最適化は MVP スコープ外。デスクトップ幅（>= 768px）で破綻しないことのみを保証する。

## 5. shadcn/ui コンポーネントマッピング

汎用要素（`Card` / `Button` / `Input` / `Textarea` 等）は shadcn/ui の標準どおり使用し、明示の指定は不要。本 doc では「使い方に判断が要る要素」のみ列挙する。

shadcn/ui は Radix UI Primitives と Tailwind を組み合わせ、コードをプロジェクトにコピーして使う方式（npm 依存ではないためロックインを避けつつ改変可能）。コンポーネント粒度の階層化（Atomic Design 等）は持ち込まない（feature-based 構成と整合させるため）。

| 用途 | コンポーネント・指針 |
| --- | --- |
| 一時通知 | `Toast`（Sonner ベース）。MVP では `internal_error` (500) のみ |
| 確認ダイアログ | `Dialog`。破壊的操作のみで使用、それ以外では使わない |
| エラー表示 | `Alert`（variant: destructive） |
| 初回ロードのプレースホルダ | `Skeleton`（要素と同形でレイアウト） |
| エージェントステータスバッジ | `Badge`（variant: pending / running / completed / failed の 4 種） |
| 全体進捗バー | `Progress`（完了率 0〜100） |
| 観点選択 | `Checkbox`（複数選択のため `Select` ではなく `Checkbox` を採用） |
| 結果マトリクス | 素の `<table>` + Tailwind（`DataTable` 等の高機能版は不採用） |
| エージェント出力ストリーミング | `Card` + `<pre>` ブロック |

`NavigationMenu` / `DataTable` 等の高機能コンポーネントは MVP では基本不採用とし、必要が確定した時点で導入する（**節度** の判断軸）。

## 6. Tailwind トークン方針

shadcn/ui のデフォルトトークン（カラー・余白・タイポ）をそのまま採用する。MVP で独自定義するのは以下のみ。

### 6.1 ステータスバッジの色

[glossary.md ステータスラベル](../product/glossary.md) の 4 状態に対応。Tailwind の意味色を `Badge` の variant として拡張する。

| 状態 | 色クラス（暫定） |
| --- | --- |
| pending | `bg-muted text-muted-foreground` |
| running | `bg-blue-100 text-blue-900` |
| completed | `bg-green-100 text-green-900` |
| failed | `bg-red-100 text-red-900` |

文字列キーは glossary.md の英語名（`pending` / `running` / `completed` / `failed`）に揃える。コントラストは AA 比（4.5:1）を満たすことを手動確認。

### 6.2 LLM 出力の表示

ストリーミング表示は `font-mono text-sm leading-relaxed` で可読性を確保する（**テキスト主体** の判断軸と整合）。

### 6.3 ダークモード

ダークモードの自動切替は MVP スコープ外。light テーマ固定で実装する（後付けは shadcn/ui の CSS 変数構造により低コスト）。

## 7. アクセシビリティ最低限

shadcn/ui（Radix UI ベース）のキーボード操作・ARIA 属性を尊重し、Hero UC 動線について WCAG 2.1 AA 相当を満たす。

- **キーボード操作**: 主要操作（実行ボタン・主要リンク）は Tab で到達、Enter で発火。focus リングは shadcn/ui デフォルト（`ring-2 ring-ring`）を保持し `outline-none` で消さない（POUR: Operable）
- **必須項目未入力時**: 実行ボタンは `disabled` で到達可能・操作不可とする（Tab スキップせず、理由を伝える）
- **ストリーミング出力**: `agent:output` 表示には `aria-live="polite"` を付与。`assertive` は使わず読み上げの割り込みを避ける（POUR: Perceivable / **ノンブロッキング** と整合）
- **focus 管理**: 画面遷移直後は `<h1>` に focus、Toast / Alert は focus を奪わない、Dialog は開閉時に内部要素と呼び出し元へ focus を移す（Radix UI デフォルト）
- **コントラスト**: shadcn/ui デフォルトテーマで AA 比（4.5:1）を満たす。§6.1 のステータスバッジ色は手動で確認（`blue-100 / blue-900` 等のペアは AA を満たす）

## 8. URL ルーティング方針

URL ルーティングを本節で確定する（§4 で参照した screen-flow.md の画面遷移を URL に対応付ける）。

### 8.1 ルート定義

| パス | 画面 | 関連 US |
| --- | --- | --- |
| `/` | テンプレート一覧 | [US-1](../product/user-stories.md#us-1-テンプレートを選んで調査を始める) |
| `/templates/:templateId/new` | 入力フォーム | [US-2](../product/user-stories.md#us-2-調査パラメータを入力して実行する) |
| `/executions/:executionId` | 進捗 / 結果（ステータスにより表示切替） | [US-3](../product/user-stories.md#us-3-エージェントの進捗をリアルタイムで見る), [US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) |
| `/history` | 履歴一覧 | [US-5](../product/user-stories.md#us-5-過去の実行履歴を振り返る) |

### 8.2 進捗 / 結果の URL を統合する根拠

- screen-flow.md 遷移補足のとおり「進捗画面から離脱しても実行はバックグラウンドで継続」する設計。離脱前後で URL が変わると履歴 / 共有時の参照が不安定になる
- US-5 の履歴経由再閲覧（`/history` → `/executions/:id`）と、US-3 完了後の結果表示が同一 URL になり、クライアントの分岐が不要（[websocket-design.md §接続ライフサイクル](./websocket-design.md) の「完了済み Execution への接続」と同じ整理）
- 進捗 → 結果の表示切替は `Execution.status`（`pending | running | completed | failed`）で判定する。実装は `GET /api/executions/:id` の status と WS の `execution:completed` / `execution:failed` を併用

### 8.3 入力フォームの URL に templateId をパスに含める根拠

- フォームはテンプレート選択を前提とした派生画面であり、`templateId` なしでは到達不可
- 将来の複数テンプレート対応時もパス階層が安定する
- 不採用: `?templateId=X` のクエリ形式 — 必須パラメータをクエリに置くと「省略可」の誤解を招く

### 8.4 ライブラリ選定

ルーティングライブラリは MVP 実装 Issue で確定する（本 doc の責務は URL 設計のみ）。候補と選定基準:

| 候補 | 想定理由 |
| --- | --- |
| React Router v7 | de facto。SSR 等の将来拡張余地あり |
| wouter / TanStack Router | バンドル軽量・型安全 |

判断基準: ①バンドルサイズ、②型安全性、③将来 SSR 移行の余地。MVP 段階では React Router v7 を第一候補として実装 Issue で最終決定する。

### 8.5 ルート不在時の挙動

- `/executions/:id` で `not_found` (404) が返った場合: §3.3 error の REST `not_found` パターンを適用（Alert + 履歴一覧へのリンク）
- 未定義パス: `/`（テンプレート一覧）へリダイレクト

## 9. 育て方

実装中の発見を都度追記する想定。次の 3 種の更新を歓迎する:

- 新しい状態パターン（partial-failure 以外の混在ケース等）の追加
- shadcn/ui コンポーネント追加時のマッピング表の更新
- ルーティングライブラリ確定時の §8.4 のコード参照への移行

## 10. 参考文献

本 doc で言及した専門用語（Doherty Threshold / Tesler's Law / Jakob's Law 等）の出典:

- Nielsen Norman Group: [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Jon Yablonski: [Laws of UX](https://lawsofux.com/)
- W3C: [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- shadcn/ui: [公式ドキュメント](https://ui.shadcn.com/) / Radix UI: [Primitives](https://www.radix-ui.com/primitives)
