# 0025. SPA ルーティングライブラリの選定（React Router v7 採用）

## Status

superseded by [0027](./0027-tanstack-router.md)

- 作成日: 2026-05-04
- 関連: ADR-0008（技術スタック）, [ui-patterns.md §8](../design/ui-patterns.md), Issue #117

## Context

Walking Skeleton（Issue #82 / PR #114）まではテンプレート一覧のみの単一画面で、ルーティングを持たない構成だった。MVP 実装フェーズ（v0.5）で US-1〜US-5 を構成する 4 ルート（`/`、`/templates/:templateId/new`、`/executions/:executionId`、`/history`）を扱うため、SPA ルーティングライブラリを確定する必要がある。

[ui-patterns.md §8.4](../design/ui-patterns.md) では候補として React Router v7 / wouter / TanStack Router を挙げ、判断基準として ①バンドルサイズ ②型安全性 ③将来 SSR 移行の余地 を記していた。本 ADR で最終決定を下す。

前提:

- フロントは React + Vite による SPA（[ADR-0008](./0008-tech-stack.md)）。サーバ実行を伴う SSR は MVP 範囲外
- API / WebSocket は Hono が SSoT（[api-design.md](../design/api-design.md), [websocket-design.md](../design/websocket-design.md)）。フロント側でバックエンド責務を担う構成は採らない
- 認証なし・シングルユーザの MVP（[ADR-0005](./0005-mvp-scope.md)）。複雑な認可ベースのルーティングは不要

## Considered Alternatives

### A. React Router v7（採用）

- 長期実績（v6 系から継続）。公式 docs・コミュニティ資料が厚く、学習プロジェクトでつまづいた際の検索ヒット率が高い
- v7 で Remix を取り込み、必要時に Framework Mode（SSR / RSC）へ「同じライブラリの延長」で拡張可能
- Vite との統合が容易（プラグイン不要、`BrowserRouter` で完結）
- バンドルサイズは中程度（gzipped で十数 KB）

### B. wouter（不採用）

- バンドル極小（数 KB）で API も最小
- ただし型安全な path/search params 推論や loader 機能を持たず、US-3 以降で機能要求が増えた際に薄さがネックになる
- SSR 移行時の選択肢が乏しい

### C. TanStack Router（不採用 / 将来再評価枠）

- 型安全な path/search params、loader、TanStack Query 公式統合などモダンな機能群
- 不採用理由:
  - エコシステム成熟度: v1 リリースが新しく、実績・周辺資料の蓄積が React Router より浅い
  - SSR への一貫性: Framework Mode のような統合パスはなく、SSR を狙うと TanStack Start 等の別レイヤを噛ませる必要がある
  - MVP 規模での過剰さ: 真価が出るのはルート数と型安全パスの恩恵が顕在化する規模感。4 ルート + シングルユーザの MVP では学習コストが上回る
  - TanStack Query との相性は決定打にならない: React Router の `loader` でも `queryClient.ensureQueryData` を呼ぶ統合は可能で、Query 採用が Router を縛る理由にならない

### D. Next.js（不採用 / ルーティングライブラリの枠を超えるため参考）

- App Router / RSC / Server Actions / API Routes を内蔵するフルスタックフレームワーク
- 不採用理由:
  - 既決の SPA + Hono 構成（[ADR-0008](./0008-tech-stack.md)）と衝突。フロント配信責務を Hono と Next.js のどちらが担うかの再決定が必要
  - API / WS の SSoT を Hono に置く設計が崩れる（API Routes / Server Actions と二重化）
  - 学習コストが大きく、本プロジェクトの主目的（AI 駆動開発サイクルの一気通貫体験）から外れる

## Decision

MVP は **React Router v7** を採用する。

US-1（Issue #117）の実装段階では、TanStack Router への乗り換えコストを低位に保つため以下の制約を置く:

- `loader` / `action` 等の Router 固有 API は使わない（`fetch` は `useEffect` 内に留める）
- API クライアントは素の `fetch` とする。状態管理ライブラリ（TanStack Query / SWR 等）の導入は US-3 以降で再判断する
- ルート定義は 1 ファイルに集約し、乗り換え時の改修箇所を可視化する
- `<Link>` / `useNavigate` の使用箇所は最小限に留め、薄いラッパー（`<AppLink>` 等）は作らない（過剰抽象化を避ける）

US-3 で TanStack Query 採用判断を行う際、本 ADR を超える機能要求（型安全 path、loader 統合、ルート増加）が顕在化していれば TanStack Router を再評価する。

## Consequences

良い面:

- 周辺資料の厚みにより、AI 協働時のつまづきが減る
- Vite + React Router v7 + Hono の組み合わせは Web 全般で広く採用されており、検索性・移植性が高い
- v7 の Framework Mode により、将来 SSR 化が必要になった際の移行パスが残る

悪い面・残課題:

- 型安全 path/search params の恩恵を MVP 段階では受けられない（必要が顕在化した時点で TanStack Router 乗り換えで取りに行く）
- `loader` / `action` の採用判断を US-1 では先送りした。US-3 以降で fetch 戦略を見直す際に、Router 固有 API へ寄せるか別ライブラリで補うかを判断する必要がある
- TanStack Query を後から導入する場合、既存の `useEffect` ベース fetch を移行する手間が発生する（境界が明確なため工数は限定的）
