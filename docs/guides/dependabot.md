# Dependabot 運用ガイド

このプロジェクトにおける Dependabot の週次運用フローをまとめたドキュメントです。設定の意思決定背景は [ADR-0022](../adr/0022-dependabot-operational-policy.md) を参照。

## 自動化されている処理

| 処理 | 主体 | 動作タイミング |
| --- | --- | --- |
| 依存パッケージのバージョン監視 | Dependabot | weekly |
| 公開直後リリースの待機（cooldown） | Dependabot | major 14d / minor 7d / patch 3d |
| GitHub Advisory（CVE）由来の更新 | Dependabot | cooldown を無視して即時 PR |
| GitHub Actions の SHA pin 追従 | Dependabot | コメントの version を書き換え |
| **patch グループ PR の auto-merge** | `dependabot-auto-merge.yml` | 必須チェック通過後 |

## PR の種類と運用

Dependabot が作る PR は 3 種類に分かれる。

| PR 種別 | 例 | 運用 |
| --- | --- | --- |
| **patch グループ** | `chore(deps): bump development-patch group with 3 updates` | 自動マージ。CI 通過確認のみ |
| **minor グループ** | `chore(deps): bump production-minor group with 2 updates` | 手動レビュー → マージ |
| **major 個別 PR** | `chore(deps): bump react from 18.x to 19.x` | 手動レビュー → 破壊的変更影響調査 → マージ |

### 1. patch グループ PR

- `production-patch` / `development-patch` / `actions-patch` のいずれか
- branch protection の必須チェック（lint / type-check / test）通過後に自動 squash マージされる
- **運用者の作業**: 通知が来たら CI 結果を確認するだけ。CI が落ちている場合のみ介入

### 2. minor グループ PR

- `production-minor` / `development-minor` / `actions-minor` のいずれか
- **運用者の作業**:
  1. 各更新の changelog を確認（PR 本文に Dependabot が自動生成）
  2. CI 通過を確認
  3. 主要な機能を手動で動作確認（特に production-minor）
  4. 問題なければマージ

### 3. major 個別 PR

- 1 パッケージ 1 PR
- **運用者の作業**:
  1. 該当ライブラリの migration guide を確認
  2. 破壊的変更の影響範囲をコードベースで調査
  3. 必要なら同 PR 内で追従修正
  4. CI 通過と動作確認後にマージ

## CVE / Security update の取扱

GitHub Advisory Database に登録された脆弱性の修正は **cooldown を無視して即時 PR 化**される。

- PR タイトルに security 関連キーワードが含まれる
- 通常の patch / minor / major と同じグループ分類で PR が作られる
- **patch レベルの security update はそのまま auto-merge 経路に乗る**
- minor / major の security update は手動だが、cooldown を待たないため即対応可能

## cooldown の意味と例外

| 種別 | 待機日数 | 例外 |
| --- | --- | --- |
| major | 14 日 | CVE は無視 |
| minor | 7 日 | CVE は無視 |
| patch | 3 日 | CVE は無視 |

**目的**: 公開直後の compromised release（npm パッケージ乗っ取り、typo-squatting）の取り下げ期間を避ける。多くの悪性リリースは公開後数時間〜数日で取り下げられる。

**例外的に cooldown を短縮したい場合**: `.github/dependabot.yml` の `cooldown:` を一時的に編集する。緊急性がなければ ADR-0022 を改訂してから恒久反映。

## 前提となる branch protection

`dependabot-auto-merge.yml` の `gh pr merge --auto` は **branch protection で必須チェックが設定されている場合のみ機能する**。

必要な main の branch protection 設定:

- [ ] Require a pull request before merging
- [ ] Require status checks to pass before merging
  - 必須チェック: `lint`, `type-check`, `test`（`ci.yml` のジョブ名）
- [ ] Require branches to be up to date before merging（任意）

未設定の場合、`--auto` は即時マージ動作となり、CI を通さずにマージされるリスクがある。**この設定はリポジトリ管理者が GitHub UI から行う必要がある**。

## トラブルシューティング

### auto-merge が動かない

1. **patch グループに minor が混入していないか**: `dependabot/fetch-metadata` の `update-type` は PR 全体の最大値を返すため、minor が 1 件でも混じると `semver-minor` になり auto-merge 条件外となる。groups の分割が崩れていないか `.github/dependabot.yml` を確認
2. **branch protection の必須チェックが未設定**: 上記「前提となる branch protection」を確認
3. **CI が落ちている**: `--auto` は CI 通過待ちなので、CI が緑になるまで待機。落ちている場合は原因対処

### cooldown でリリース取り込みが遅すぎる

- CVE 由来でなく単に新機能を早く取り込みたい場合は、該当 PR を待つか、`.github/dependabot.yml` で個別パッケージを `cooldown.exclude:` に追加する選択肢もある
- ただし exclude を増やすほどサプライチェーン耐性が落ちるので、追加時は ADR で記録

### SHA pin の手動更新が必要なとき

- 通常は Dependabot が SHA pin を維持したままコメントの version を書き換えるため手動更新は不要
- 新規 action を追加する場合のみ `git ls-remote --tags <repo URL>` で当該タグの commit SHA を取得して `@<SHA> # v<version>` 形式で記述する

### Workspace に新規 package を追加したとき

- `apps/*` または `packages/*` 配下に追加する限り、`directories: ["/", "/apps/*", "/packages/*"]` の glob で自動的に監視対象になる
- それ以外の場所（例: `tools/` などを将来追加）に配置した場合は `.github/dependabot.yml` の `directories` に追記が必要

### 期待していた更新 PR が作られていない

Dependabot は `open-pull-requests-limit`（npm: 10 / github-actions: 5）に達した場合、追加の PR を **エラーや通知なしに静かにスキップ**する。workspace 数 × グループ数で同時 PR 数が増加した結果、limit に到達している可能性がある。

確認手順:

1. Dependabot 由来の open PR 数を集計
   - `gh pr list --author "app/dependabot" --state open --label chore`
2. limit に張り付いている場合の対処
   - 既存の Dependabot PR をマージまたは close して空きを作る
   - 恒久的に PR 数が増える構造になっているなら `.github/dependabot.yml` の `open-pull-requests-limit` の引き上げを検討（ADR-0022 を改訂してから恒久反映）

## 関連

- [ADR-0022](../adr/0022-dependabot-operational-policy.md) — Dependabot 運用方針の意思決定
- `.github/dependabot.yml` — 設定本体
- `.github/workflows/dependabot-auto-merge.yml` — auto-merge ワークフロー
