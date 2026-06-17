# 0042. CI への依存スキャン（bun audit）導入と閾値 critical の選定

## Status

accepted

- 作成日: 2026-06-17
- 関連: ADR-0022（Dependabot 運用方針／補完）, ADR-0037（サンドボックス方針／補完）

## Context

2026-06-17、npm エコシステムで Mastra（AI エージェントフレームワーク）のサプライチェーン攻撃が発覚した。元コントリビューターのアカウントを乗っ取り、144 パッケージに `easy-day-js`（`dayjs` のタイポスクワット）を依存追加し、`postinstall` で第2段ペイロード（暗号資産窃取型 RAT）を取得・自己削除する手口だった。

当リポジトリは当該パッケージに非依存で侵害は無かったが、この機に防御状況を点検した。既存のサプライチェーン防御層は以下:

- Bun デフォルトの no-lifecycle-scripts（`postinstall` 等を自動実行しない）
- `bunfig.toml` の `minimumReleaseAge`（公開直後バージョンの回避）
- Dependabot cooldown（ADR-0022）
- CodeQL（自前コードの SAST）

死角は「依存パッケージの既知 CVE・侵害バージョンの検知」だった。CodeQL は自前コードの静的解析であり、依存ツリーの脆弱性・侵害は対象外。これを埋める依存スキャン層が必要と判断した。

調査の結果、`bun audit` は当時点で既知の advisory を 26 件検出した（high 4 / moderate 19 / low 3）が、いずれも開発ツール由来の通常 CVE で、install 時自動実行型のマルウェアはゼロだった（high の esbuild RCE は Deno モジュール専用で、SHA-256 検証を持つ Bun/Node は対象外）。これらは親ツール（drizzle-kit / secretlint / markdownlint-cli2 等）が既に最新版でも nested 依存を未 patch のため、依存アップグレードでは解消できない状態だった。

## Considered Alternatives

- **overrides で推移依存を patched 版へ固定**: 技術的には可能だが、親ツールが最新でも上流が nested 依存を未 patch のため手動ピンとなり、Dependabot が追従せず保守負担が大きい。上流更新時の外し忘れリスクもある。→ 却下
- **依存を直接アップグレード**: 該当は dev ツールの推移依存で、親ツールは既に最新。`bun update --latest` でも上流未 patch のため解消しない。→ 不可
- **`--audit-level=high` ハードゲート**: dev ツール由来の既存 high（当リポでは非 exploitable）で CI が常時赤になり、無関係な PR まで止まる。→ 却下
- **`--audit-level=high` + `--ignore` 許可リスト**: 検知力は最大だが、26 件規模の GHSA を手動メンテするのは非現実的。→ 却下
- **非ブロッキング（informational）**: ログ表示のみで PR を止めない。攻撃を自動遮断する目的に対して弱い。→ 却下
- **`--audit-level=critical` ハードゲート**: install 時マルウェア／lockfile 侵害は critical で報告されるため自動ブロックしつつ、dev ツールの通常 CVE バックログ（当リポで非 exploitable）では止めない。手動リスト不要で低保守。→ 採用

## Decision

CI（`.github/workflows/ci.yml`）に `audit` ジョブを追加し、`bun audit --audit-level=critical` を実行する。

- `bun audit` は `bun.lock` を直接参照するため `bun install` / cache は不要。ジョブは checkout → setup-bun → audit のみ。
- 外部 advisory DB への HTTP 依存によるハングを防ぐため `timeout-minutes: 5` を設定。
- CodeQL（自前コードの SAST）を補完し、既存の no-lifecycle-scripts / `minimumReleaseAge` / Dependabot cooldown（ADR-0022）と合わせた多層防御とする。

スコープ判断（本決定では実装しない／後続検討）:

- トリガーは `on: pull_request` のみ。常時監視（`schedule` cron / `push: main`）は follow-up とする。
- `timeout-minutes` は audit ジョブのみに設定し、既存ジョブへの一括適用は本決定の範囲外とする。

## Consequences

- ポジティブ:
  - `postinstall` ドロッパー等の install 時マルウェア（critical 相当）を CI で自動遮断できる。
  - CodeQL の死角（依存パッケージの既知 CVE・サプライチェーン侵害）を補完する。
  - 手動 ignore リスト・override を持たないため低保守。`bun.lock` 参照のみで実行が高速。
- ネガティブ / リスク:
  - 本番依存に将来 high 以下の実行時 CVE が出ても自動ブロックされない。→ 対策: Dependabot の定期更新と `minimumReleaseAge` / cooldown が担当する。
  - critical の検知は registry advisory の登録速度に依存し、0-day は捕捉できない。→ 対策: no-lifecycle-scripts と `minimumReleaseAge` が公開直後の自動実行・即時導入を遅延・遮断する層を提供する。
  - `pull_request` トリガーのみのため、main への直 push やマージ後に登録された新規 critical は次の PR まで未検知。→ 対策（後続 Issue 候補）: `schedule` / `push: main` トリガーの追加を検討する。
- 中立:
  - 既存 dev ツールの high/moderate CVE バックログ（26 件）は残存し、audit ログには表示されるがブロックはしない。上流ツールの更新で漸減する見込み。
