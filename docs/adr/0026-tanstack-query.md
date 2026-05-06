# 0026. web 層のデータ取得ライブラリの選定（TanStack Query 採用）

## Status

accepted

- 作成日: 2026-05-06
- 関連: ADR-0005（MVP スコープ）, ADR-0025（ルーティング再評価を予告）, Issue #131

## Context

US-1・US-2 では `fetch + useEffect + reloadTokenRef / aborted` による手製の race condition 対策パターンを採用した。ADR-0025 では「US-3 以降で TanStack Query 採用を再判断する」と明示していた。

US-3 以降の要件:

- US-3: WebSocket 中心だが Execution メタの初期 HTTP 取得が必要
- US-4: 完了済み Execution の結果取得・エクスポート
- US-5: 履歴一覧（キャッシュ・将来のページング相性◎）

同じ取得パターンを US-4/US-5 で再度手書きすることを避けるため、本 ADR で方針を確定する。

## Considered Alternatives

### A. TanStack Query（採用）

- race condition・loading/error 状態・キャッシュを自動管理し、手製の `reloadTokenRef` が不要になる
- `useQuery` / `useMutation` の分離で HTTP GET と POST の責務が明確
- 業界標準。学習目的プロジェクトでのエコシステム体験として価値が高い
- ADR-0027 で TanStack Router も採用するため、エコシステムが統一される

### B. SWR

- 軽量で API がシンプル
- ページング・DevTools・`useMutation` の充実度が TanStack Query に劣る
- TanStack Router を採用するエコシステム統一の観点からも TQ が優位

### C. fetch + 薄い hook

- 追加依存なし
- `reloadTokenRef` 相当の boilerplate を US-3/4/5 ごとに再実装する必要がある
- キャッシュ・再取得・エラー境界の扱いが非一貫になりやすい

### D. fetch 直書き（継続・不採用）

- US 間で重複コードが増える。US-3 で書いた取得ロジックを US-4/US-5 で再実装する問題が解消されない

## Decision

`@tanstack/react-query` を採用する。

スコープ（MVP）:

- `useQuery` による HTTP GET のみ。既存 US-1/US-2 の POST（`fetch` 直書き）には遡って適用しない
- `QueryClient` は `main.tsx` でアプリ全体に提供する（`QueryClientProvider`）
- WebSocket 接続（US-3）はスコープ外。素の WebSocket または専用カスタム hook で扱う

## Consequences

良い面:

- `reloadTokenRef` / `aborted` フラグ等の手製 race condition 対策が不要になる
- loading / error / data の取り扱いが統一される
- US-5 の履歴一覧で自動キャッシュが効く

悪い面・残課題:

- `QueryClientProvider` のラップが必要（設定は最小限で影響は限定的）
- 既存 US-1/US-2 の `useEffect` ベース fetch は即時移行を必須としない。新規画面から `useQuery` を使い始める
