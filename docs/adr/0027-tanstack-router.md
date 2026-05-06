# 0027. SPA ルーティングライブラリの再選定（TanStack Router 採用 / ADR-0025 supersede）

## Status

accepted

- 作成日: 2026-05-06
- 関連: ADR-0025（supersede）, ADR-0026（TanStack Query 採用）, Issue #131

## Context

ADR-0025 では React Router v7 を採用した。その時点での TanStack Router 不採用理由:

1. v1 リリースが新しく周辺資料が浅い
2. SSR 移行時に TanStack Start 等の別レイヤが必要
3. 4 ルートの MVP 規模では型安全 params の恩恵が過剰
4. TanStack Query 採用が Router 選択を縛る理由にならない

ADR-0025 の Decision では「US-3 で TanStack Query 採用判断を行う際、型安全 path・loader 統合・ルート増加が顕在化していれば TanStack Router を再評価する」と明記した。

本 ADR で再評価を実施する。再評価時点の変化:

- ADR-0026 で TanStack Query を採用決定し、エコシステム統一の観点が加わった
- US-3/4/5 の 3 ルート追加で計 4 ルートが確定し、型安全 path params の恩恵が顕在化した（例: `/executions/$executionId`）
- React Router v7 の実装は US-1/2 の 2 ルート・4 ファイルに留まり、移行コストが最小の段階

## Considered Alternatives

### A. TanStack Router（採用）

- TanStack Query との公式統合（ルート `loader` 内で `queryClient.ensureQueryData`）により prefetch が自然に書ける
- 型安全 path/search params。`/executions/$executionId` 等で TypeScript がパス typo を検出できる
- 同一エコシステム（TQ + TR）で、データ取得とルーティングの責務を一貫したパターンで扱える
- US-3/4/5 実装前の今がルート移行コストが最小（2 ルート・4 ファイルの影響範囲）

### B. React Router v7（継続・不採用）

- ADR-0025 時点の選定理由（資料の厚さ・SSR 移行パス）は今も有効
- TQ と別ベンダーだが共存は技術的に問題なし
- ただし型安全 path params の恩恵を受けるには将来の乗り換えが必要であり、US-3/4/5 実装後に移行するよりも今の方がコストが低い

## Decision

TanStack Router を採用する。ADR-0025 を supersede する。

移行方針:

- `react-router` を依存から削除し `@tanstack/react-router` に置き換える
- ルート定義は `apps/web/src/router.tsx` に集約する（コードベースルーティング）
- US-3/4/5 未実装ルートは `beforeLoad` で `/` にリダイレクトするスタブを置き、実装時に置き換える
- ADR-0025 の制約（loader/action を使わない・fetch を useEffect に閉じる）を廃止する。新規画面は TanStack Query の `useQuery` を使う

## Consequences

良い面:

- path params が型安全になる。typo によるランタイムエラーをコンパイル時に検出できる
- TQ との統合により、将来的に loader で prefetch が可能
- エコシステムが TanStack に統一され、API の一貫性が高まる

悪い面・残課題:

- React Router v7 からの移行作業が発生する（現時点で 2 ルート・4 ファイル、影響は限定的）
- コードベースルーティングはルート数が増えると `router.tsx` が肥大化する。ルート数が 10 を超えた段階でファイルベースへの移行を再評価する
- `createRoute` の `getParentRoute` / `addChildren` を手書きするため、子ルートの登録忘れ等の親子関係の不一致をコンパイラが検出できないケースがある（ランタイムで 404 になる）
- `getRouteApi("/path/$param")` に渡すパス文字列は `router.tsx` の path 定義と一致しなくてもコンパイルエラーにならない。新規ルート実装時は `router.tsx` の path と `getRouteApi` の引数が一致しているか手動で確認する
