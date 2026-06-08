# 0036. Web 層テスト方針に Testing Trophy を採用

## Status

accepted

- 作成日: 2026-06-08
- 関連: ADR-0010（型駆動 + 軽量 TDD）, ADR-0024（Playwright MCP）, ADR-0026（TanStack Query）, ADR-0027（TanStack Router）, Issue #240

## Context

ADR-0010 で型駆動 + 軽量 TDD を採用し、テスト戦略は Service 層（`apps/api`）中心の Test Pyramid として確立した。MVP では React コンポーネント・hook テストを明示的に見送り、UI 動作確認は Playwright MCP（ADR-0024）で代替している。

この結果、`apps/web`（React + TanStack Router/Query）の**自動テストの位置付けが空白**になっている。現状 `apps/web` には純粋ロジック（`parseAgentOutput` 等）と reducer（`useExecutionWs`）の `bun:test` ユニットテストは存在するが、コンポーネント・データ取得フックの結合テストをいつ・どう書くかの判断基準がない。後続の Web 機能追加（US-2 以降の CRUD 拡張等）で判断負荷が出る。

TanStack Query / Router の採用（ADR-0026 / 0027）により、データ取得・ルーティングの分岐ロジックがフックに集約され、純粋関数の単体テストだけでは観測可能な振る舞いを検証しきれない領域が増えた。フロントエンドのテスト業界標準も Test Pyramid から **Testing Trophy**（Kent C. Dodds, 2021）へ移り、2025-26 時点で主流となっている。

## Considered Alternatives

| 方針 | 概要 | 判定 | 根拠 |
| --- | --- | --- | --- |
| Test Pyramid を Web 層にも一律適用 | unit を最厚にする | 見送り | フロントで細粒度のコンポーネント単体を厚くすると実装詳細への結合と脆さ（Fragile Test）が増える。業界標準もピラミッドからトロフィーへ移行 |
| **Testing Trophy** | Static → Unit → **Integration（最大層）** → E2E | **採用** | 2025-26 のフロント標準。「統合」を主層に置きユーザー視点の振る舞い検証へ寄せる。React Testing Library / TanStack 公式の前提と一致し、principles の振る舞い検証軸（§1）とも整合 |
| E2E を Web 層の主軸にする | Playwright で画面を通しで検証 | 見送り | ADR-0010 の E2E 見送り方針を維持。画面が少なくコスト > 価値。Playwright MCP（ADR-0024）の開発時動作確認で当面足りる |

## Decision

- **Web 層（`apps/web`）のテストモデルとして Testing Trophy を採用する。** Service 層（`apps/api`）は引き続き Test Pyramid を維持する。両者は層の特性差（Service = ロジック中心 / Web = ユーザー操作と表示の結合中心）に応じた使い分けであり、矛盾しない。整合の整理は [principles/testing.md](../principles/testing.md) に置く。
- 価値あるテストの判定軸 SSoT は引き続き principles/testing.md（振る舞い検証・経路独立性・「書かない」判断）。Testing Trophy はその軸を Web 層に適用する際の**比率モデル**として位置づける。
- コンポーネント・結合テストの導入時は、ランナー・ツールを業界標準に合わせて **vitest + React Testing Library + MSW + jsdom（or happy-dom）** を採用する前提とする。現状の純粋ロジック・reducer の `bun:test` は維持し、移行は強制しない。
- **実装はスコープ外。** 導入トリガ条件と TanStack Query の推奨パターンは [guides/testing.md](../guides/testing.md) に置く。

## Consequences

- Web 層テストの位置付けと判断基準が明確化し、機能追加時の判断負荷が下がる。
- Service = Pyramid / Web = Trophy の 2 モデルが併存し、テスト設計時にどちらの層かを意識する必要が生じる。
- vitest + RTL + MSW の導入はトリガ成立時に依存追加・CI 設定の追加コストを伴う。導入後は `bun:test`（純粋ロジック）と vitest（コンポーネント/結合）のランナー二重化が生じうる（MVP 内では解消せず許容し、vitest への完全移行の是非は後続 ADR で判断する）。
- 新規業界標準の採用に伴い、[principles/README.md](../principles/README.md) 第 2 部 帰属表に Testing Trophy を追記した（[ADR-0017 §4](./0017-design-development-principles.md)）。
- ADR-0010 の E2E 見送り方針と Playwright MCP（ADR-0024）による開発時 UI 動作確認は変更しない。本決定は自動テストの方針を補うものであり、既存方針を置き換えない。
