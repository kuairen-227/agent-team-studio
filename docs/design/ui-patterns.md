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

本節の各原則は以下の業界標準に紐付く。本 doc は学習教材としても機能させるため、英語名と出典を併記する（語彙の詳細は [§10 用語集](#10-用語集) 参照）:

- **Nielsen 10 ユーザビリティヒューリスティック** — UX 業界の de facto 標準（出典: Nielsen Norman Group）
- **Laws of UX** — 認知心理学に基づく UI 設計法則集（出典: lawsofux.com）
- **WCAG 2.1 POUR** — アクセシビリティの国際標準（出典: W3C）

### 1.1 進捗の可視化を最優先

Hero UC（30 分以内の競合比較）の体感価値は「何が今動いているかが見える」ことに直結する（[ADR-0005 エージェント実行の可視化](../adr/0005-mvp-scope.md), [US-3](../product/user-stories.md#us-3-エージェントの進捗をリアルタイムで見る)）。進捗画面では他要素より上に状態バッジ・ストリーミング出力を配置し、ナビ・装飾は最小化する。

**根拠**: Nielsen #1 *Visibility of system status*（システム状態を常にユーザーに伝える）/ *Doherty Threshold*（応答が 400ms を超えるとユーザーの集中が切れる）/ *Goal-Gradient Effect*（目標達成が見えるほど加速感を得られる）。

### 1.2 partial failure に優しい

[agent-execution.md §6](./agent-execution.md) のとおり 1 体の Investigation 失敗でも統合は続行する設計。UI も「全成功」と「部分失敗」を等価に扱い、失敗観点を別レイアウトに追いやらず、結果マトリクス内で `missing[]` セクションを並列に提示する（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準と整合）。

**根拠**: Nielsen #9 *Help users recognize, diagnose, and recover from errors*（エラーを隠さず認識・診断・回復を支援する）/ *Tesler's Law*（複雑性は消えず誰かが負う = システム側で吸収せず UI で扱う）/ *Peak-End Rule*（最後の体験が記憶を支配する = 部分失敗の見せ方が UX 全体の印象を決める）。

### 1.3 テキスト主体の情報設計

成果物は LLM の自然言語出力。アイコン・装飾よりテキストの可読性（行間・段落幅・コントラスト）を優先する。マトリクスもグラフ化せず、テキストセル + Markdown エクスポートを主成果物とする（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする)）。

**根拠**: *Visual Hierarchy*（情報の重要度を視覚的階層で示す）/ *F-pattern*（左→右→下のスキャン視線。テキスト密度の高い画面で支配的）。

### 1.4 ノンブロッキング

実行開始後はバックグラウンド継続が前提（[screen-flow.md §遷移補足](../product/screen-flow.md)）。モーダル等で操作を遮断せず、ユーザーがいつでも他画面へ離脱できる導線を残す。確認ダイアログは破壊的操作のみ。

**根拠**: Norman *Feedback Loop*（行動 → 反応 → 評価のサイクルを途切れさせない。モーダルは評価フェーズを強制中断する）。

### 1.5 学習プロジェクトとしての節度

shadcn/ui のデフォルトテーマ・余白・タイポを尊重し、独自トークンの導入は最小限にする（[ADR-0005 ロックイン回避](../adr/0005-mvp-scope.md)）。「自前デザインシステム」を作らない。

**根拠**: *Jakob's Law*（ユーザーは他サイトで身につけた慣習を期待する = 既知のパターンに従う）/ *Aesthetic-Usability Effect*（整った見た目は使いやすさの知覚も向上させる = 既存テーマの完成度を借りる）。

### 1.6 キーボードファースト

ドッグフーディングを担う PdM / エンジニアの反復利用前提（[ADR-0004](../adr/0004-target-users.md)）。主要導線（テンプレート選択・実行ボタン・結果コピー）はマウスなしで完結できること。focus リングは shadcn/ui デフォルトを保持する。

**根拠**: *Fitts's Law*（ターゲット到達時間はサイズと距離で決まる = キーボードはこの法則を回避できる手段）/ WCAG *Operable*（キーボードのみで全機能が操作可能であること）。

### 1.7 再現性・持ち出しやすさ

成果物は Markdown でクリップボード / ファイル両方に持ち出せる（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする)）。UI 上のレイアウト崩れが Markdown 出力に波及しないよう、表示用構造とエクスポート用構造を分離する（実装上は Result.structured を SSoT とし、UI もエクスポートも同一データから派生）。

**根拠**: SSoT（Single Source of Truth）原則。表示と出力を同一データから派生させ、データの二重化を避ける。

## 2. 状態パターン

各画面の loading / empty / error / partial-failure の表示ルールを統一する。語彙は [glossary.md ステータスラベル](../product/glossary.md) と整合。

### 2.1 loading

| 種別 | 表現 | コンポーネント |
| --- | --- | --- |
| 初回ロード（リスト・詳細） | Skeleton を表示要素と同形でレイアウト | `Skeleton` |
| アクション後の短時間待ち（< 1 秒想定） | ボタンを `disabled` 化し、ラベルを「実行中…」等に切替 | `Button` の disabled 状態 |
| 進捗画面の WS 接続待ち | 「接続中…」テキストを進捗エリア上部に表示 | テキストのみ |

スピナー単独表示は使わない（情報量が低く、原則 1.3 と矛盾）。

**根拠**: *Skeleton screen*（コンテンツ形状を先に提示することで *perceived performance* を上げる）/ *Doherty Threshold*（応答 400ms を超えるなら待ち状態を可視化する）。

### 2.2 empty

| 種別 | 表現 |
| --- | --- |
| 履歴 0 件 | 中央寄せで「まだ実行がありません」+ テンプレート一覧へ戻る導線 |
| その他 | MVP では履歴のみ想定（テンプレートはシードで常に 1 件以上 / [screen-flow.md 未決事項](../product/screen-flow.md) と整合） |

メッセージは原則 1.3 に従い 1 行のテキスト + 次アクションのリンク 1 つで構成。イラストは持たない。

**根拠**: Nielsen #6 *Recognition rather than recall*（次アクションを画面上に提示し、ユーザーに想起を強いない）。

### 2.3 error

実行処理の失敗は WS 経由で届くため、REST のエラー表示と分けて扱う。

| 起源 | 表現 | コンポーネント |
| --- | --- | --- |
| REST `validation_error` (400) | フォーム項目の直下に inline メッセージ。`details[].field` でフィールドにマッピング | フォーム要素直下のテキスト |
| REST `not_found` (404) | 画面中央に Alert + 一覧画面へのリンク | `Alert` (variant: destructive) |
| REST `internal_error` (500) | Toast で一時表示し、ユーザー操作は継続可能 | `Toast` |
| 接続レベル WS エラー（`4404 execution_not_found` / `1011 server_error`） | 進捗画面に Alert を出し、「履歴一覧から確認」導線を併記（[websocket-design.md §再接続ポリシー](./websocket-design.md) のとおり自動再接続なし） | `Alert` (variant: destructive) |

文言は [api-design.md](./api-design.md) の `message` をそのまま表示する。UI 側で再構成しない（SSoT 原則）。

**根拠**: Nielsen #5 *Error prevention*（バリデーションでエラー発生自体を抑止する）/ Nielsen #9 *Help users recover from errors*（エラー文言は問題と回復手段を平易な言葉で示す）。

### 2.4 partial-failure

[agent-execution.md §6](./agent-execution.md) で `Result.structured.missing[]` に格納される観点を、結果マトリクス内に専用セクションとして提示する。

- マトリクス本体（行 = 観点、列 = 競合）からは失敗観点の行を除外せず、空セルに `missing` のラベルを表示
- マトリクス下部に「未取得観点」セクションを配置し、`missing[].perspective` と `reason`（`agent_failed` / `insufficient_evidence`）を列挙
- Markdown エクスポートも同構造を保持する（UI とエクスポートで構造を二重化しない）
- `agent:status status="failed"` の `reason`（`llm_error` / `output_parse_error` / `timeout` / `internal_error`）は進捗画面のステータスバッジに併記し、結果画面では集約された `missing[].reason` のみ扱う

統合エージェントが失敗した場合（`Execution.status = failed` / `error_message: "integration_failed"`）は Result が未作成のため、結果画面では各 `AgentExecution.output` を観点別カードで表示する（[US-4](../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準）。

**根拠**: *Tesler's Law*（複雑性は消えないため UI 側で扱う = 失敗観点を非表示にせず別セクションで明示する）。

## 3. グローバルナビ方針

[screen-flow.md 未決事項](../product/screen-flow.md) のグローバルナビ配置を本節で確定する。

### 採用方針: ヘッダー固定

**根拠**: *Jakob's Law*（ユーザーは他の Web プロダクトでヘッダー固定ナビに慣れている。慣習に従うことで学習コストを下げる）。

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

**shadcn/ui の "primitives" 思想**: shadcn/ui は Radix UI Primitives（アクセシビリティと挙動のみを提供する非装飾コンポーネント群）と Tailwind CSS を組み合わせ、コードを直接プロジェクトにコピーして使う方式を取る。npm パッケージ依存ではないためロックインを避けつつ、必要に応じて改変できる。本 doc のマッピング表は「どの primitive を画面のどこで使うか」の対応関係であり、コンポーネントの粒度を Atomic Design 等の階層で抽象化する責務は持たない（[architecture.md フロントエンド](./architecture.md) の feature-based 構成と整合）。

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

shadcn/ui のデフォルトカラーセット（`slate` ベース）をそのまま採用する（*Aesthetic-Usability Effect*: 整ったデフォルトテーマは使いやすさの知覚も上げる）。

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

Tailwind デフォルト（4px grid）を使用。これは UI 業界で広く使われる *8pt grid system*（余白を 8 の倍数で揃え視覚的整合性を出す手法）の半分単位の派生で、shadcn/ui コンポーネントもこのスケールに沿う。多用する値を以下に限定し、揺れを抑える。

- カード内パディング: `p-4` または `p-6`
- セクション間: `space-y-6` または `space-y-8`
- フォーム要素間: `space-y-4`
- ヘッダー高さ: `h-14`

### 5.4 タイポグラフィ

shadcn/ui デフォルト（`font-sans` = システムフォント）を使用。見出しサイズは *Modular Scale*（一定比率で段階を作る手法）に基づくが、独自設計はせず shadcn/ui の既定スケールに従う。見出しスケール:

- ページタイトル: `text-2xl font-semibold`
- セクション見出し: `text-lg font-semibold`
- 本文: `text-base`
- 補助テキスト: `text-sm text-muted-foreground`

LLM 出力（ストリーミング表示）は `font-mono text-sm leading-relaxed` で可読性を確保する。

## 6. アクセシビリティ最低限

shadcn/ui（Radix UI ベース）のキーボード操作・ARIA 属性を尊重し、以下の最低ラインを満たす。MVP の対象範囲は WCAG レベル AA 相当のうち、Hero UC の動線に必要な項目に限定する。

本節は **WCAG 2.1 POUR** の 4 原則に対応付ける。各サブセクションが POUR のどれに対応するかを明示する:

- **Perceivable**（知覚可能）: §6.2 `aria-live`, §6.4 コントラスト
- **Operable**（操作可能）: §6.1 キーボード操作, §6.3 focus 管理
- **Understandable**（理解可能）: §2.3 error 文言の明確化（既出）
- **Robust**（堅牢）: shadcn/ui の Radix ベース ARIA 実装に依存（独自実装で壊さない）

### 6.1 キーボード操作（POUR: Operable）

- 実行ボタン・主要リンクは Tab で到達でき、Enter で発火する（shadcn/ui デフォルトで担保）
- フォームの必須項目未入力時は実行ボタンが `disabled` のため、Tab スキップではなく到達可能・操作不可とする（理由が伝わる）
- focus リングは shadcn/ui デフォルト（`ring-2 ring-ring`）を保持し、`outline-none` で消さない

### 6.2 ストリーミング出力の `aria-live`（POUR: Perceivable）

進捗画面の `agent:output` ストリーミング表示には `aria-live="polite"` を付与する。スクリーンリーダーが新規チャンクを通知できるようにする一方、`assertive` は使わず読み上げの割り込みを避ける（原則 1.4 ノンブロッキング）。

### 6.3 focus 管理（POUR: Operable）

- 画面遷移直後は、当該画面の主見出し（`<h1>`）に focus を当てる（React Router 側で実装、ライブラリは実装 Issue で確定）
- Toast / Alert は focus を奪わない（操作の流れを遮らない）
- Dialog（破壊的操作の確認のみ）は開いたとき内部の最初の操作要素に focus、閉じたとき呼び出し元に戻す（Radix UI デフォルト）

### 6.4 コントラスト（POUR: Perceivable）

shadcn/ui デフォルトテーマで AA 比（4.5:1）を満たす。§5.2 のステータスバッジ色は手動で確認すること（`blue-100 / blue-900` 等のペアは AA を満たす）。

## 7. URL ルーティング方針

[screen-flow.md 未決事項](../product/screen-flow.md) の URL ルーティングを本節で確定する。

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

## 10. 用語集

本 doc で言及した UI/UX 専門用語の一覧。学習目的（[CLAUDE.md](../../CLAUDE.md) 「技術的な内容を理解しながら進める」）のため、本文に英語名併記で散りばめた用語をここに集約する。

### 10.1 Nielsen 10 ユーザビリティヒューリスティック

Jakob Nielsen が 1994 年に提唱した 10 個のヒューリスティック（経験則）。本 doc では以下 5 個を参照。

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| #1 Visibility of system status | システム状態の可視化 | システムが今何をしているかを常にユーザーに伝える | §1.1 |
| #5 Error prevention | エラー予防 | エラー文言を出すより、エラー発生自体を防ぐ設計を優先 | §2.3 |
| #6 Recognition rather than recall | 想起より認識 | 選択肢・次アクションを画面上に提示し、記憶に頼らせない | §2.2 |
| #8 Aesthetic and minimalist design | 美的最小限デザイン | 必要のない情報を含めない（情報量と注目度はトレードオフ） | §1.5（節度の根拠） |
| #9 Help users recover from errors | エラーからの回復支援 | エラー文言は問題と回復手段を平易に示す | §1.2, §2.3 |

### 10.2 Laws of UX

認知心理学・人間工学に基づく UI 設計法則集（Jon Yablonski）。本 doc では以下 8 個を参照。

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| Doherty Threshold | ドハティ閾値 | 応答が 400ms を超えるとユーザーの集中が切れる | §1.1, §2.1 |
| Goal-Gradient Effect | 目標勾配効果 | 目標達成が見えるほど加速感を得られる | §1.1 |
| Hick's Law | ヒックの法則 | 選択肢が増えるほど決定時間は対数的に増加する | （参照のみ） |
| Tesler's Law | テスラーの法則（複雑性保存則） | 複雑性は消えず誰かが負う = システム側で吸収せず UI で扱う | §1.2, §2.4 |
| Jakob's Law | ヤコブの法則 | ユーザーは他サイトで身につけた慣習を期待する | §1.5, §3 |
| Peak-End Rule | ピーク・エンド則 | 体験の評価はピークと終端で決まる | §1.2 |
| Fitts's Law | フィッツの法則 | ターゲット到達時間はサイズと距離で決まる | §1.6 |
| Aesthetic-Usability Effect | 美的-実用性効果 | 整った見た目は使いやすさの知覚も向上させる | §1.5, §5.1 |

### 10.3 WCAG 2.1 POUR

W3C のアクセシビリティガイドライン（Web Content Accessibility Guidelines）の 4 原則。各原則を頭文字で POUR と呼ぶ。

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| Perceivable | 知覚可能 | 全ユーザーが情報を知覚できる（コントラスト・代替テキスト等） | §6.2, §6.4 |
| Operable | 操作可能 | キーボード等あらゆる入力手段で操作できる | §1.6, §6.1, §6.3 |
| Understandable | 理解可能 | UI と内容が理解できる文言・挙動である | §2.3 |
| Robust | 堅牢 | 支援技術（スクリーンリーダー等）と互換である | §6 全体（Radix UI 依存） |

### 10.4 Norman 認知工学（参照のみ）

Don Norman『誰のためのデザイン?』の中核概念。本 doc では Feedback Loop のみ参照。

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| Affordance | アフォーダンス | モノが「何ができるか」をユーザーに示す物理的特性 | （参照のみ） |
| Signifier | シグニファイア | アフォーダンスを伝えるための記号・装飾（ボタンの凸表現等） | （参照のみ） |
| Mental Model | メンタルモデル | ユーザーがシステムの動作について抱く内的モデル | （参照のみ） |
| Feedback Loop | フィードバックループ | 行動 → 反応 → 評価のサイクル。UI は各段階を支援する | §1.4 |

### 10.5 Gestalt 原則（参照のみ）

ゲシュタルト心理学に由来する視覚知覚の法則群。本 doc ではレイアウト判断の暗黙の根拠として参照。

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| Proximity | 近接 | 近くにある要素は同じグループとして知覚される | （参照のみ） |
| Similarity | 類似 | 似た形・色の要素は同じグループとして知覚される | （参照のみ） |

### 10.6 その他の用語

| 英語名 | 日本語 | 1 行説明 | 本 doc 内参照 |
| --- | --- | --- | --- |
| Skeleton screen | スケルトン画面 | 表示要素と同形のプレースホルダーを先に描画する待機表現 | §2.1 |
| Perceived performance | 知覚パフォーマンス | 実測速度より「速く感じる」ことを優先する設計観 | §2.1 |
| Visual Hierarchy | 視覚的階層 | 情報の重要度をサイズ・色・位置で示す | §1.3 |
| F-pattern | F パターン | テキスト密度の高い画面で支配的な視線軌跡（左→右→下） | §1.3 |
| 8pt grid system | 8pt グリッド | 余白を 8 の倍数で揃え視覚的整合性を出す手法 | §5.3 |
| Modular Scale | モジュラースケール | 一定比率で見出しサイズの段階を作る手法 | §5.4 |
| shadcn/ui primitives | shadcn/ui プリミティブ | Radix UI Primitives + Tailwind をコードコピーで使う方式 | §4 |
| SSoT | 単一の真実の源 | 同じデータを複数箇所で持たず、1 つの源から派生させる原則 | §1.7, §2.3 |

### 10.7 参考文献

- Nielsen Norman Group: [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Jon Yablonski: [Laws of UX](https://lawsofux.com/)
- W3C: [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- Don Norman: 『誰のためのデザイン? — 認知科学者のデザイン原論』（増補・改訂版, 新曜社, 2015）
- shadcn/ui: [公式ドキュメント](https://ui.shadcn.com/)
- Radix UI: [Primitives](https://www.radix-ui.com/primitives)
