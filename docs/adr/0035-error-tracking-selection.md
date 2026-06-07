# 0035. エラートラッキング基盤の選定（Sentry free / SaaS 採用）

## Status

accepted

- 作成日: 2026-06-07
- 関連: ADR-0002（学習プロジェクトの状況設定）, ADR-0028（env 部品変数方式）, ADR-0033（構造化ロギング・補完関係）, Issue #237（選定と導入）, 親トラッカ #235（開発フロー基盤）

## Context

observability 基盤のうち、アプリケーションログ層は整備済みである:

- 構造化ログ（Pino, ADR-0033）— ハンドルされた例外・実行フローを JSON で stdout 出力
- trace ID 伝搬（Issue #239）— `hono/request-id` で UUID を生成し、response ヘッダ `X-Request-Id`・Pino child logger・error response の `details.traceId` に相関
- グローバル `onError`（`apps/api/src/lib/errors.ts`）— 500 経路で `logger.error({ err })` を出力

未整備なのは **未キャッチ例外・ブラウザ側エラーの集約・通知・トリアージ** の層である。現状:

- apps/api: 例外は Pino に出るが、集約・通知・経時トレンド・グルーピングの手段がない
- apps/web: グローバル error boundary が未実装（`router.tsx` は素の `<Outlet />`）。クライアントエラーの捕捉手段がゼロ

本 ADR はこの層を埋める error tracking 基盤を選定する。

### 学習目的を判断軸に据える

本プロジェクトは学習プロジェクト（ADR-0002）であり、**本番デプロイの予定は現時点でない**。したがって選定は「本番運用コスト」ではなく **「監視運用のベストプラクティスを学べるか」** を主軸に置く。

ここで「監視運用」は 2 層に分かれることを明示する:

1. **利用運用** — トリアージ（resolve / ignore / regression 検知）、アラート設計、通知連携、release 紐付け、PII 抑止、ダッシュボード hygiene
2. **基盤運用** — 監視スタック自体の起動・アップグレード・ストレージ・取り込み基盤の運用

実務で「監視運用ベストプラクティス」と呼ばれる作業の大半は ①利用運用 であり、②基盤運用 は SRE 寄りの専門領域である。本プロジェクトの学習主眼は ①利用運用 を **業界標準ツールで** 身につけることに置く。

### SDK は選定対象から外れる（バックエンド非依存）

error tracking SDK は **Sentry SDK が事実上の標準**であり、Sentry SaaS でも Sentry 互換 OSS（GlitchTip）でも同じ SDK が使える。したがって「どの SDK を入れるか」は実質一意で、選定が分岐するのは **イベント送信先（DSN）= バックエンド** のみ。バックエンドを後から差し替えても、アプリ側コードは DSN 変更で済む（ロックインが薄い）。

## Considered Alternatives

| # | 方式 | 採否 | 理由 |
| - | --- | --- | --- |
| A | **Sentry free（SaaS）** | **採用** | ①利用運用 を業界標準 UI/workflow で学べる。実務で最も遭遇するのが Sentry。ローカル app から `sentry.io` へイベントを送るだけで本番不要。setup 軽量・運用ゼロ。外部送信ゆえ before-send での PII redact が必須となるが、これ自体が実務必須の学びどころ。将来 DSN を自前バックエンドへ差し替え可能 |
| B | GlitchTip 自前ホスト（docker-compose） | 却下 | 主たる追加価値は ②基盤運用（監視スタックの自前運用）だが、これは本プロジェクトの学習主眼（①利用運用）とズレる。UI は Sentry 風の簡易クローンで、業界標準そのものではない。本番がないためローカルでしか動かず、WSL2 環境にコンテナ 3〜4 個・~1GB RAM の負荷だけが残る |
| C | SDK 抽象レイヤのみ実装し送信先は保留 | 却下 | コンテナも外部依存も増えない最小案だが、受け入れ条件「未キャッチ例外/uncaught error が tracking に送信されている」を満たさず、①利用運用 を一切学べない。本 ADR の主眼（監視運用を学ぶ）に反する |

### 補足: Sentry free tier の制約

- エラーイベント 5K/月、データ retention 約 30 日、performance イベントは少量枠。学習用途では十分。
- アカウント登録が必要。DSN は環境変数で注入する（`.env` 部品変数方式・ADR-0028 と整合）。
- イベントが外部 SaaS に送信されるため、**送信前の PII/機密 redact が必須**（既存 Pino redact 対象 = `authorization` / `cookie` / `apiKey` / `token` / `password` と整合させる）。

## Decision

**エラートラッキング基盤として Sentry free tier（SaaS）を採用する。** 学習主眼は ①利用運用 を業界標準ツールで習得することに置く。

### 1. 採用構成

- SDK は Sentry SDK を使用する。apps/api = `@sentry/bun`（Hono 対応）、apps/web = `@sentry/react`。
- イベント送信先は Sentry SaaS（free tier）。DSN は環境変数で注入し、未設定時は送信を無効化（ローカル開発で DSN なしでも起動できる）する方針とする。

### 2. 既存 observability との関係

| 層 | 担当 | 関係 |
| --- | --- | --- |
| 構造化ログ（ADR-0033 / Pino） | ハンドルされた例外・実行フロー・アクセスログ | 補完。重複しない |
| error tracking（本 ADR / Sentry） | 未キャッチ例外・ブラウザエラーの集約・通知・トリアージ | 補完。重複しない |
| trace ID（#239 / `X-Request-Id`） | 両者を貫通する相関 ID | Sentry tag に乗せてログ↔エラーを突き合わせる |

### 3. スコープ外（後続作業）

本 ADR は選定のみを扱う。SDK 組み込み（apps/api の `onError`・fire-and-forget 経路での `captureException`、before-send による PII redact、apps/web の `@sentry/react` ErrorBoundary 追加と TanStack Query 連携、trace ID 相関、env への DSN 追加、ドキュメント）は実装 Issue（#237 の導入フェーズ）に委ねる。

## Consequences

### ポジティブ

- **①利用運用 を業界標準で学べる** — トリアージ・アラート・release 紐付け・PII 抑止という実務で最も転用が効くスキルを、実際に Sentry を触りながら習得できる。
- **本番不要・運用ゼロ** — ローカル app から SaaS へ送信するだけで完結し、本番デプロイのない現状と整合する。コンテナ追加・スタック運用が発生しない。
- **PII 抑止が自然に学べる** — 外部送信が前提のため before-send redact の設計が必須となり、本番で必ず求められるスキルが身につく。
- **ロックインが薄い** — SDK は Sentry 互換のため、将来 GlitchTip 等の自前バックエンドへ DSN 差し替えで移行できる。
- **既存基盤と補完** — 構造化ログ・trace ID と重複せず、observability セットの最後のピースを埋める。

### ネガティブ / リスク

- **外部 SaaS へのデータ送信** — エラーイベントが `sentry.io` に送られる（送信前 redact は Decision §3 で扱う）。
- **②基盤運用は学べない** — 監視スタックの自前運用（取り込み基盤・スケール・アップグレード）の経験は得られない。
- **free tier の枠** — 5K events/月・retention 約 30 日・performance 少量枠の制約がある。
- **外部アカウント・DSN 管理** — Sentry アカウントと DSN シークレットの管理が増える（DSN 注入方式は Decision §1 で扱う）。

### 中立

- **GlitchTip は将来の選択肢として残る** — ②基盤運用 を学びたくなった場合、または本番でデータ主権が要件化した場合に、SDK 不変のまま DSN 差し替えで導入できる。
- **SDK 選定は分岐しない** — バックエンドに依らず Sentry SDK を使うため、本 ADR の決定は実質「送信先の選定」であり、アプリ側コードの選択肢は一意。
