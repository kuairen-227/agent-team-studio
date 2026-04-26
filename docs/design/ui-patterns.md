# UI パターン & デザイン原則

UI/UX 面の設計指針。デザイン原則・状態パターン・グローバルナビ・shadcn/ui コンポーネントマッピング・Tailwind トークン・アクセシビリティ・URL ルーティングを定める。本 doc は実装上の迷い所の判断基準を提供し、Figma 等の編集資産を持たない代わりに Markdown で一元管理する。

前提:

- [ADR-0005 MVP スコープ](../adr/0005-mvp-scope.md) — Hero UC・成功基準・スコープ外
- [ADR-0008 技術スタック](../adr/0008-tech-stack.md) — React + Vite / shadcn/ui / Tailwind v4
- [user-stories.md](../product/user-stories.md) — US-1〜US-5 受入基準
- [glossary.md](../product/glossary.md) — UI 表記・ステータス語彙
- [screen-flow.md](../product/screen-flow.md) — 画面遷移（本 doc は UX 構造の技術的受け皿）
- [agent-execution.md](./agent-execution.md) — partial-failure / `missing[]` のデータ表現
- [websocket-design.md](./websocket-design.md) — `agent:status` / `agent:output` の語彙

## 1. UI/UX デザイン原則

shadcn/ui の素朴なデフォルトを土台に、以下の 7 原則を意思決定の優先順位として置く。優先度は上から降順で、矛盾する場合は上位を取る。

**ブランド軸**: AI を魔法に見せず、進捗・限界・失敗を誠実に見せる。ユーザーの判断を奪わず、判断材料を提供する。以下の 7 原則はこの軸から派生する。視覚的な独自性は最小限に留め、ブランドは見た目ではなく体験の一貫性で示す（原則 1.5 と整合）。

### 1.1 進捗の可視化を最優先

Hero UC（30 分以内の競合比較）の体感価値は「何が今動いているかが見える」ことに直結する（[ADR-0005 エージェント実行の可視化](../adr/0005-mvp-scope.md), [US-3](../product/user-stories.md#us-3-エージェントの進捗をリアルタイムで見る)）。進捗画面では他要素より上に状態バッジ・ストリーミング出力を配置し、ナビ・装飾は最小化する。

**思想**: 「動いている感」が Hero UC の体感価値そのもの。応答 400ms を超えるとユーザーの集中は切れ（Doherty Threshold）、逆に進捗が見えるほど加速感が増す（Goal-Gradient Effect）。だから装飾より状態表示を上に置く。

### 1.2 partial failure に優しい

[agent-execution.md §6](./agent-execution.md) のとおり 1 体の Investigation 失敗でも統合は続行する設計。UI も「全成功」と「部分失敗」を等価に扱い、失敗観点を別レイアウトに追いやらず、結果マトリクス内で `missing[]` セクションを並列に提示する（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準と整合）。

**思想**: 失敗を隠す UI は、ユーザーに「全成功」の誤った印象を残す。複雑性は消えず誰かが負う（Tesler's Law）以上、システム側で隠さず UI で明示するのが筋。終端の体験が記憶を支配する（Peak-End Rule）ため、失敗の見せ方こそが UX の質を決める。

### 1.3 テキスト主体の情報設計

成果物は LLM の自然言語出力。アイコン・装飾よりテキストの可読性（行間・段落幅・コントラスト）を優先する。マトリクスもグラフ化せず、テキストセル + Markdown エクスポートを主成果物とする（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする)）。

**思想**: LLM 成果物は文章そのものが価値。視線軌跡は左→右→下にスキャンする（F-pattern）ため、可読性 > 装飾の優先順位を全画面で貫く。

### 1.4 ノンブロッキング

実行開始後はバックグラウンド継続が前提（[screen-flow.md §遷移補足](../product/screen-flow.md)）。モーダル等で操作を遮断せず、ユーザーがいつでも他画面へ離脱できる導線を残す。確認ダイアログは破壊的操作のみ。

**思想**: 行動 → 反応 → 評価のフィードバックループを途切れさせない。モーダルは評価フェーズを強制的に止めるため、破壊的操作以外では使わない。

### 1.5 学習プロジェクトとしての節度

shadcn/ui のデフォルトテーマ・余白・タイポを尊重し、独自トークンの導入は最小限にする（[ADR-0005 ロックイン回避](../adr/0005-mvp-scope.md)）。「自前デザインシステム」を作らない。

**思想**: ユーザーは他プロダクトで身につけた慣習を期待する（Jakob's Law）。整ったデフォルトは使いやすさの知覚も上げる（Aesthetic-Usability Effect）。学習プロジェクトの限られた工数で、車輪の再発明より既存テーマの完成度を借りる。

### 1.6 キーボードファースト

ドッグフーディングを担う PdM / エンジニアの反復利用前提（[ADR-0004](../adr/0004-target-users.md)）。主要導線（テンプレート選択・実行ボタン・結果コピー）はマウスなしで完結できること。focus リングは shadcn/ui デフォルトを保持する。

**思想**: 反復利用ではマウスのターゲット到達コスト（Fitts's Law）が累積する。キーボード操作はこれを回避できる手段であり、同時に WCAG の Operable 要件にも合致する。

### 1.7 再現性・持ち出しやすさ

成果物は Markdown でクリップボード / ファイル両方に持ち出せる（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする)）。UI 上のレイアウト崩れが Markdown 出力に波及しないよう、表示用構造とエクスポート用構造を分離する（実装上は Result.structured を SSoT とし、UI もエクスポートも同一データから派生）。

**思想**: 表示と出力で同じデータを二重に持つと、片方の修正が他方に伝播しない。Result.structured を Single Source of Truth とし、UI もエクスポートも派生物に位置付ける。

## 2. 状態パターン

各画面の loading / empty / error / partial-failure の表示ルールを統一する。語彙は [glossary.md ステータスラベル](../product/glossary.md) と整合。

**ボイス & トーン**: 技術者の同僚として淡々と状態を伝える。「頑張っています」「もう少しお待ちください」のような感情表現や催促はせず、事実（実行中・完了・失敗の理由）だけを提示する。エラー文言は責めず、煽らず、回復手段を簡潔に示す。これは §1 のブランド軸「誠実に見せる」を文言レベルで実装する規約。

### 2.1 loading

| 種別 | 表現 | コンポーネント |
| --- | --- | --- |
| 初回ロード（リスト・詳細） | Skeleton を表示要素と同形でレイアウト | `Skeleton` |
| アクション後の短時間待ち（< 1 秒想定） | ボタンを `disabled` 化し、ラベルを「実行中…」等に切替 | `Button` の disabled 状態 |
| 進捗画面の WS 接続待ち | 「接続中…」テキストを進捗エリア上部に表示 | テキストのみ |

スピナー単独表示は使わない（情報量が低く、原則 1.3 と矛盾）。

**思想**: 待ち時間そのものを縮められないなら、待っている間に「これから何が出るか」を見せて知覚速度を上げる（Skeleton screen による perceived performance）。

### 2.2 empty

| 種別 | 表現 |
| --- | --- |
| 履歴 0 件 | 中央寄せで「まだ実行がありません」+ テンプレート一覧へ戻る導線 |
| その他 | MVP では履歴のみ想定（テンプレートはシードで常に 1 件以上 / [screen-flow.md 未決事項](../product/screen-flow.md) と整合） |

メッセージは原則 1.3 に従い 1 行のテキスト + 次アクションのリンク 1 つで構成。イラストは持たない。

**思想**: 空状態は「次に何をすればいいか」を画面上で示す場。記憶に頼らせず、選択肢を提示する（Recognition over Recall）。

### 2.3 error

実行処理の失敗は WS 経由で届くため、REST のエラー表示と分けて扱う。

| 起源 | 表現 | コンポーネント |
| --- | --- | --- |
| REST `validation_error` (400) | フォーム項目の直下に inline メッセージ。`details[].field` でフィールドにマッピング | フォーム要素直下のテキスト |
| REST `not_found` (404) | 画面中央に Alert + 一覧画面へのリンク | `Alert` (variant: destructive) |
| REST `internal_error` (500) | Toast で一時表示し、ユーザー操作は継続可能 | `Toast` |
| 接続レベル WS エラー（`4404 execution_not_found` / `1011 server_error`） | 進捗画面に Alert を出し、「履歴一覧から確認」導線を併記（[websocket-design.md §再接続ポリシー](./websocket-design.md) のとおり自動再接続なし） | `Alert` (variant: destructive) |

文言は [api-design.md](./api-design.md) の `message` をそのまま表示する。UI 側で再構成しない（SSoT 原則）。

**思想**: エラー文言は API 側を SSoT とし、UI 側で言い換えない。多重定義は文言ドリフトを生む。

### 2.4 partial-failure

[agent-execution.md §6](./agent-execution.md) で `Result.structured.missing[]` に格納される観点を、結果マトリクス内に専用セクションとして提示する。

- マトリクス本体（行 = 観点、列 = 競合）からは失敗観点の行を除外せず、空セルに `missing` のラベルを表示
- マトリクス下部に「未取得観点」セクションを配置し、`missing[].perspective` と `reason`（`agent_failed` / `insufficient_evidence`）を列挙
- Markdown エクスポートも同構造を保持する（UI とエクスポートで構造を二重化しない）
- `agent:status status="failed"` の `reason`（`llm_error` / `output_parse_error` / `timeout` / `internal_error`）は進捗画面のステータスバッジに併記し、結果画面では集約された `missing[].reason` のみ扱う

統合エージェントが失敗した場合（`Execution.status = failed` / `error_message: "integration_failed"`）は Result が未作成のため、結果画面では各 `AgentExecution.output` を観点別カードで表示する（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準）。

## 3. グローバルナビ方針

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
| ハンバーガー + Drawer | MVP のナビ項目 2 個に対し過剰。原則 1.5（節度）と矛盾 |

### モバイル対応

[ユーザーストーリー Non-goals](../product/user-stories.md#non-goalsmvp-で意図的に含めないもの) のとおりモバイル最適化は MVP スコープ外。デスクトップ幅（>= 768px）で破綻しないことのみを保証する。

## 4. shadcn/ui コンポーネントマッピング

各画面 × 要素で使用する shadcn/ui コンポーネントを列挙する。実装時の選択コストを下げる目的で、新規導入時は本表を更新してから着手する。

shadcn/ui は Radix UI Primitives と Tailwind を組み合わせ、コードをプロジェクトにコピーして使う方式。npm 依存ではないためロックインを避けつつ改変できる。本表はその primitive と画面要素の対応関係に絞り、コンポーネント粒度の階層化（Atomic Design 等）は持ち込まない（feature-based 構成と整合させるため）。

| 画面 | 要素 | コンポーネント |
| --- | --- | --- |
| 共通 | ヘッダーリンク | `NavigationMenu`（または素の `<a>` + Tailwind） |
| 共通 | 一時通知 | `Toast`（Sonner ベース） |
| 共通 | 確認ダイアログ | `Dialog` |
| 共通 | エラー表示 | `Alert` |
| テンプレート一覧 | テンプレートカード | `Card` |
| テンプレート一覧 | 一覧の loading | `Skeleton` |
| 入力フォーム | テキスト入力 | `Input`, `Textarea` |
| 入力フォーム | 観点選択 | `Checkbox` または `Select`（複数選択対応で `Checkbox` を優先） |
| 入力フォーム | 実行ボタン | `Button` |
| 進捗 | エージェントステータスバッジ | `Badge`（variant: pending/running/completed/failed の 4 種） |
| 進捗 | 進捗バー | `Progress`（全体の完了率を 0〜100 で表示） |
| 進捗 | エージェント出力カード | `Card` + `<pre>` ブロック |
| 結果 | マトリクス | 素のテーブル（`<table>` + Tailwind）。`DataTable` 等は導入しない |
| 結果 | コピー / ダウンロード | `Button` |
| 履歴一覧 | 履歴カード | `Card` |
| 履歴一覧 | 空状態 | テキストのみ（コンポーネントなし） |

`NavigationMenu` / `Sonner` / `DataTable` 等の高機能コンポーネントは MVP では基本不採用とし、必要が確定した時点で導入する（原則 1.5）。

## 5. Tailwind トークン方針

shadcn/ui のデフォルトトークンを基準とし、追加・変更は本節に明示する。

### 5.1 テーマ色

shadcn/ui のデフォルトカラーセット（`slate` ベース）をそのまま採用する。

| ロール | クラス（light / dark） | 用途 |
| --- | --- | --- |
| 背景 | `bg-background` | ページ背景 |
| 前景 | `text-foreground` | 本文テキスト |
| 補助テキスト | `text-muted-foreground` | キャプション・空状態文言 |
| 区切り線 | `border-border` | ヘッダー下線・カード境界 |
| 主アクション | `bg-primary text-primary-foreground` | 実行ボタン・コピーボタン |
| 警告・破壊的 | `bg-destructive text-destructive-foreground` | エラー Alert |

ダークモードの自動切替は MVP スコープ外。light テーマ固定で実装する（後付けは shadcn/ui の CSS 変数構造により低コスト）。

### 5.2 ステータスバッジの色

[glossary.md ステータスラベル](../product/glossary.md) の 4 状態に対応。Tailwind の意味色を直接使う。

| 状態 | 色クラス（暫定） |
| --- | --- |
| pending | `bg-muted text-muted-foreground` |
| running | `bg-blue-100 text-blue-900`（dark: `bg-blue-900/30 text-blue-100`） |
| completed | `bg-green-100 text-green-900` |
| failed | `bg-red-100 text-red-900` |

shadcn/ui `Badge` の variant をカスタム拡張する形で実装し、文字列キーは glossary.md の英語名（`pending` / `running` / `completed` / `failed`）に揃える。

### 5.3 余白スケール

Tailwind デフォルト（4px grid、8pt grid system の半分単位の派生）を使用。多用する値を以下に限定し、揺れを抑える。

- カード内パディング: `p-4` または `p-6`
- セクション間: `space-y-6` または `space-y-8`
- フォーム要素間: `space-y-4`
- ヘッダー高さ: `h-14`

### 5.4 タイポグラフィ

shadcn/ui デフォルト（`font-sans` = システムフォント）を使用。見出しスケールは shadcn/ui の既定に従い、独自設計はしない。

- ページタイトル: `text-2xl font-semibold`
- セクション見出し: `text-lg font-semibold`
- 本文: `text-base`
- 補助テキスト: `text-sm text-muted-foreground`

LLM 出力（ストリーミング表示）は `font-mono text-sm leading-relaxed` で可読性を確保する。

## 6. アクセシビリティ最低限

shadcn/ui（Radix UI ベース）のキーボード操作・ARIA 属性を尊重し、以下の最低ラインを満たす。MVP の対象範囲は WCAG 2.1 レベル AA 相当のうち、Hero UC の動線に必要な項目に限定する。本節の項目は WCAG の 4 原則 POUR（Perceivable / Operable / Understandable / Robust）のうち、操作と知覚に該当する。

### 6.1 キーボード操作

- 実行ボタン・主要リンクは Tab で到達でき、Enter で発火する（shadcn/ui デフォルトで担保）
- フォームの必須項目未入力時は実行ボタンが `disabled` のため、Tab スキップではなく到達可能・操作不可とする（理由が伝わる）
- focus リングは shadcn/ui デフォルト（`ring-2 ring-ring`）を保持し、`outline-none` で消さない

### 6.2 ストリーミング出力の `aria-live`

進捗画面の `agent:output` ストリーミング表示には `aria-live="polite"` を付与する。スクリーンリーダーが新規チャンクを通知できるようにする一方、`assertive` は使わず読み上げの割り込みを避ける（原則 1.4 ノンブロッキング）。

### 6.3 focus 管理

- 画面遷移直後は、当該画面の主見出し（`<h1>`）に focus を当てる（React Router 側で実装、ライブラリは実装 Issue で確定）
- Toast / Alert は focus を奪わない（操作の流れを遮らない）
- Dialog（破壊的操作の確認のみ）は開いたとき内部の最初の操作要素に focus、閉じたとき呼び出し元に戻す（Radix UI デフォルト）

### 6.4 コントラスト

shadcn/ui デフォルトテーマで AA 比（4.5:1）を満たす。§5.2 のステータスバッジ色は手動で確認すること（`blue-100 / blue-900` 等のペアは AA を満たす）。

## 7. URL ルーティング方針

URL ルーティングを本節で確定する（[screen-flow.md](../product/screen-flow.md) の画面遷移を URL に対応付ける）。

### 7.1 ルート定義

| パス | 画面 | 関連 US |
| --- | --- | --- |
| `/` | テンプレート一覧 | [US-1](../product/user-stories.md#us-1-テンプレートを選んで調査を始める) |
| `/templates/:templateId/new` | 入力フォーム | [US-2](../product/user-stories.md#us-2-調査パラメータを入力して実行する) |
| `/executions/:executionId` | 進捗 / 結果（ステータスにより表示切替） | [US-3](../product/user-stories.md#us-3-エージェントの進捗をリアルタイムで見る), [US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) |
| `/history` | 履歴一覧 | [US-5](../product/user-stories.md#us-5-過去の実行履歴を振り返る) |

### 7.2 進捗 / 結果の URL を統合する根拠

- screen-flow.md 遷移補足のとおり「進捗画面から離脱しても実行はバックグラウンドで継続」する設計。離脱前後で URL が変わると履歴 / 共有時の参照が不安定になる
- US-5 の履歴経由再閲覧（`/history` → `/executions/:id`）と、US-3 完了後の結果表示が同一 URL になり、クライアントの分岐が不要（[websocket-design.md §接続ライフサイクル](./websocket-design.md) の「完了済み Execution への接続」と同じ整理）
- 進捗 → 結果の表示切替は `Execution.status`（`pending | running | completed | failed`）で判定する。実装は `GET /api/executions/:id` の status と WS の `execution:completed` / `execution:failed` を併用

### 7.3 入力フォームの URL に templateId をパスに含める根拠

- フォームはテンプレート選択を前提とした派生画面であり、`templateId` なしでは到達不可
- 将来の複数テンプレート対応時もパス階層が安定する
- 不採用: `?templateId=X` のクエリ形式 — 必須パラメータをクエリに置くと「省略可」の誤解を招く

### 7.4 ライブラリ選定

ルーティングライブラリは MVP 実装 Issue で確定する（本 doc の責務は URL 設計のみ）。候補と選定基準:

| 候補 | 想定理由 |
| --- | --- |
| React Router v7 | de facto。SSR 等の将来拡張余地あり |
| wouter / TanStack Router | バンドル軽量・型安全 |

判断基準: ①バンドルサイズ、②型安全性、③将来 SSR 移行の余地。MVP 段階では React Router v7 を第一候補として実装 Issue で最終決定する。

### 7.5 ルート不在時の挙動

- `/executions/:id` で `not_found` (404) が返った場合: §2.3 error の REST `not_found` パターンを適用（Alert + 履歴一覧へのリンク）
- 未定義パス: `/`（テンプレート一覧）へリダイレクト

## 8. 関連ドキュメント

- [user-stories.md](../product/user-stories.md) — US-1〜US-5 受入基準
- [screen-flow.md](../product/screen-flow.md) — 画面遷移（本 doc の前提）
- [glossary.md](../product/glossary.md) — UI 表記・ステータス語彙
- [architecture.md](./architecture.md) — フロントエンドの feature-based 構成
- [agent-execution.md](./agent-execution.md) — partial-failure / `missing[]` の意味
- [websocket-design.md](./websocket-design.md) — 進捗画面が消費するメッセージ語彙
- [api-design.md](./api-design.md) — エラー表示文言の SSoT
- [ADR-0005 MVP スコープ](../adr/0005-mvp-scope.md) / [ADR-0008 技術スタック](../adr/0008-tech-stack.md)

## 9. 育て方

本 doc は初版を 7 セクションで切り、実装中の発見を都度追記する想定。次の 3 種の更新を歓迎する:

- 新しい状態パターン（partial-failure 以外の混在ケース等）の追加
- shadcn/ui コンポーネント追加時のマッピング表の更新
- ルーティングライブラリ確定時の §7.4 のコード参照への移行

## 10. 参考文献

本 doc で言及した専門用語（Doherty Threshold / Tesler's Law / Jakob's Law 等）の出典:

- Nielsen Norman Group: [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Jon Yablonski: [Laws of UX](https://lawsofux.com/)
- W3C: [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- shadcn/ui: [公式ドキュメント](https://ui.shadcn.com/) / Radix UI: [Primitives](https://www.radix-ui.com/primitives)
