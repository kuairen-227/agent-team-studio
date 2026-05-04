---
name: implement-feature
description: 機能実装・改修を type-first + テストファーストの手順（Step 0 で型差分確認 → RED → GREEN → リファクタリング → 統合確認）で進める。enhancement / bug ラベルの Issue 実装で使う。
when_to_use: ユーザーが「実装して」「機能追加して」「修正して」「TDD で進めて」などと言ったとき、または process-issue から実装フェーズに入るとき
argument-hint: "[issue-number-or-context]"
allowed-tools: Bash(bun run:*) Bash(bun add:*) Bash(bunx shadcn:*) Bash(bunx biome:*) Bash(git add:*) Bash(git commit:*) Bash(git diff:*) Bash(git log:*) Bash(git status:*) Bash(gh issue view:*) Bash(gh issue list:*) Read Grep Glob Edit Write Agent Skill(create-adr) mcp__playwright__*
---

# implement-feature

機能実装・改修を type-first + テストファーストで進める。各ステップにチェックポイントを置き、判断の前倒しと省略の自己検出を行う。

`$ARGUMENTS` には Issue 番号または要件の文脈を受け取る。`process-issue` から呼ばれた場合は Issue context を引き継ぐ。

## 想定する適用範囲

- **適用する**: `enhancement` / `bug` ラベルの Issue。コードの振る舞いに変更が入る
- **適用しない**: `chore` / `documentation` / ADR 単独。これらは `process-issue` 単独または `create-adr` / `write-*-doc` 等の専用 skill を使う

## 手順

### Step 0. 要件読み込み + 型差分確認

実装着手前のチェックポイント。**ここを飛ばさない**ことが本 skill の核。

1. **要件の確認**
   - `process-issue` から呼ばれた場合: Issue 番号と合意済み計画を受領済みのため、再 `gh issue view` は不要。受領内容を頭出しで確認
   - 直接呼ばれた場合: `gh issue view <issue-number>` または `$ARGUMENTS` から要件を整理

2. **型差分の特定**
   - 影響する `packages/shared` のドメイン型・API 型を特定する
   - 新規型が必要なら型定義案をユーザーに提示
   - 既存型を流用する場合も型名と定義場所をユーザーに提示

3. **チェックポイント（ユーザー承認）**
   - 型差分または流用先を提示し承認を得る
   - 「おまかせ」「進めて」と指示された場合は承認スキップ可
   - 自明な既存型流用（同型をそのまま使うだけ）はユーザーに通知のみで承認待ちなしでよい

### Step 1. テスト作成（RED）

API 変更を含む場合:

- Service 層のテストを **実装より先に** 書く（必須）
- 最低 1 ケース（典型的な成功経路）から開始でよい。残りのケース（404 / 500 / boundary 等）は GREEN 後に追加でも可
- `bun run test` で **失敗することを確認してから Step 2 に進む**
- テスト追加は独立コミットにする（推奨）。タイトル例: `test(api): xxx の service テストを追加`

Step 1 を skip して Step 2 に進む場合（例: 自明なリファクタで振る舞いが変わらない / 設定値や依存の追加のみで振る舞いに影響しない）は、ユーザーに理由を通知（承認待ちなし可）したうえで、コミットメッセージまたは PR 本文に同じ理由を残す。

UI のみの変更:

- React コンポーネントの単体テストはテスト戦略上見送り（[testing.md](../../../docs/principles/testing.md)）。本 step は適用外
- 代わりに Step 4 の Playwright MCP 検証を計画に含める

### Step 2. 実装（GREEN）

API 変更:

- Repository → Service → Route の順で実装する
- 各層を実装したら `bun run test` を回し、Step 1 のテストが GREEN になることを確認

Web 変更:

- `features/<feature-name>/` 抽出 → ページコンポーネント実装 → ルート登録の順
- shadcn/ui コンポーネントが必要なら `bunx shadcn add <name>` で追加
- 追加後は `bunx biome check --write src/components/ui/<file>` で format を揃える

実装は独立したコミットにする（推奨）。タイトル例: `feat(api): xxx を実装`

### Step 3. リファクタリング

- テストが通り続けることを確認しながら整える
- CLAUDE.md の「過剰な抽象化を避ける」「不要な相互参照を作らない」原則に従う
- 必要なら追加のテストケース（404 / 500 / boundary）をここで足す

### Step 4. 統合確認

- `bun run lint && bun run lint:md && bun run lint:secret && bun run type-check && bun run test && bun run build` が全緑であることを確認
- UI を伴う変更の場合: `bun run dev`（apps/web + apps/api）→ Playwright MCP で受入条件を再現確認（[ai-ui-verification.md](../../../docs/guides/ai-ui-verification.md)）

### Step 5. 完了報告

- Issue の受入条件への対応状況を一覧で示す
- スコープ外として残した課題を明示
- 次のステップ（PR 作成等）を提案

## 注意点

横断軸（ユーザー判断優先・スコープ厳守等）は [設計・開発原則](../../../docs/principles/README.md) を参照。

implement-feature 固有の注意点:

- **層またぎ Issue（API + Web）**: 基本は API → Web の順。Web を先行する場合は fake API を明示し、本物 API への置換時期も合意しておく
- **ADR が必要になったら**: 同一 PR で `create-adr` を呼ぶか、先行 PR に切り出すかを判断。依存が重い決定（技術スタック追加・配置方針変更等）は先行 PR を優先
- **コミット粒度**: 「テスト追加」「実装」「リファクタリング」「ドキュメント更新」は分けるのが基本。ただし MVP 規模で過剰分割になるなら 1 PR 内の順序維持で許容
- **既存コードの理解**: 変更対象のコードを Read で読んでから修正する
