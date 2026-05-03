# 0022. Dependabot 運用方針

## Status

accepted

- 作成日: 2026-05-03
- 関連: ADR-0002（前提・状況設定）, ADR-0008（前提: monorepo 構造の根拠）

## Context

`.github/dependabot.yml` は最低限の設定（npm root + github-actions、production / development の依存タイプ別グループ）で運用していたが、以下の課題があった:

1. **GitHub Actions のタグ pin** — `actions/checkout@v6` 等のタグ pin はリリースタグの差し替えで任意コードを実行されるリスクがある（タグはリポジトリ所有者が再付与可能）
2. **monorepo workspace の監視漏れ** — `apps/*` `packages/*` 配下の依存はルートの `bun.lock` 経由で更新される依存しか拾えず、各 workspace の `package.json` で個別に固定されているバージョンが Dependabot の対象外となる
3. **patch 適用の遅延** — 全更新を手動マージしているため、低リスクな patch（バグ修正のみ）の適用も人手が律速になる
4. **major と minor/patch の混在** — minor/patch と major が同一グループにまとまり、major の破壊的変更レビューが埋もれる
5. **公開直後の悪性リリースへの曝露** — 新バージョン公開直後に発覚することの多い compromised package / typo-squatting に対する待機期間が無く、Dependabot が即時 PR 化することで取り下げに巻き込まれるリスクがある

ユーザー要望は **(a) サプライチェーン対策の強化** と **(b) 運用負荷の抑制**。両軸を満たす運用方針を本 ADR で確定する。

## Considered Alternatives

### GitHub Actions の pin 方式

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | タグ pin（現状: `actions/checkout@v6`） | 却下 — タグはリポジトリ所有者が任意の commit に再付与可能。リリースタグ差し替えによる任意コード実行を許す |
| B | **commit SHA pin（`@<40 桁 SHA> # v6`）** | **採用** — SHA は不変。Dependabot は SHA pin を維持したまま末尾コメントの version を書き換えて追従するため、運用負荷は変わらない（OpenSSF Scorecard・GitHub 公式推奨） |

### monorepo workspace の集約

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `directory: "/"` のみ（現状） | 却下 — `apps/*` `packages/*` 配下の `package.json` で固定されている依存の更新を拾えない |
| B | workspace 単位で update エントリを複数定義 | 却下 — エントリが膨らみ、共通の `cooldown` / `groups` 設定の重複が増える |
| C | **`directories: ["/", "/apps/*", "/packages/*"]` で集約** | **採用** — 1 エントリで monorepo 全 workspace を監視。共通設定の重複が無く、PR は workspace ごとに分割される |

### auto-merge の対象範囲

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 全更新を手動マージ（現状） | 却下 — patch（バグ修正のみ）の適用が人手律速になる |
| B | **patch のみ auto-merge、minor/major は手動** | **採用** — patch は破壊的変更を含まない（semver 規約）ため、CI 通過なら基本安全。minor は API 追加で挙動変化の可能性、major は破壊的変更でレビュー必須 |
| C | minor まで auto-merge | 却下 — npm エコシステムでは semver 違反の minor リリース（実質的な破壊的変更）が散見される。学習プロジェクトの規模ではレビューコストが許容範囲 |

### groups の分割粒度

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | groups で update-types を限定せず全部入り（現状） | 却下 — major が他の更新と束ねられ、破壊的変更レビューが埋もれる |
| B | groups を `update-types: ["minor","patch"]` で 1 つにまとめ major のみ個別 PR | 却下 — `dependabot/fetch-metadata` の `update-type` は **PR 全体の最大更新タイプ**を返す仕様のため、グループに minor が 1 件でも混入すると `version-update:semver-minor` を返し、patch 自動マージが発火しない週が発生する |
| C | **groups を patch / minor で別グループに分割し、major は groups 対象外として個別 PR 化** | **採用** — patch グループは確実に `update-type == version-update:semver-patch` となり auto-merge が安定発火。minor グループは PR 単位で手動レビュー、major は個別 PR で別途レビュー、と方針が完全に直交する |

### cooldown（公開直後リリースの待機）

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | cooldown を設定しない（現状） | 却下 — 新バージョン公開直後に発覚する compromised release / typo-squatting で取り下げに巻き込まれる |
| B | **`cooldown` を全 ecosystem に設定（major 14d / minor 7d / patch 3d）** | **採用** — 公開直後の悪性リリースの取り下げ期間を回避できる。**GitHub Advisory（CVE）由来のセキュリティ更新は cooldown を無視するため、脆弱性対応速度は犠牲にならない**（Dependabot 公式仕様） |
| C | 一律 7 日 | 却下 — patch は破壊的変更を含まないため、より短い待機（3 日）でリスク低減効果が十分得られる。major は破壊的変更レビューに時間が必要かつ malicious risk も高いため長め（14 日）が望ましい |

## Decision

### 1. GitHub Actions の SHA pin

`.github/workflows/*.yml` の全 action を `@<40 桁 SHA> # <version>` 形式に統一する。version 部分は Dependabot がコメントを自動書き換えで追従する。

### 2. monorepo workspace の集約

`.github/dependabot.yml` の npm エントリを `directories: ["/", "/apps/*", "/packages/*"]` に変更し、全 workspace を監視対象にする。

### 3. patch 自動マージ

`.github/workflows/dependabot-auto-merge.yml` を新設し、`dependabot/fetch-metadata` の `update-type == 'version-update:semver-patch'` の場合のみ `gh pr merge --auto --squash` を実行する。`--auto` は branch protection の必須チェック通過を待つため、CI（lint / type-check / test）が通った場合のみマージされる。

minor / major は手動レビューを維持する。

なお Dependabot が作る PR は同一リポジトリ発のため、fork PR に課される `GITHUB_TOKEN` の read-only 制限を受けない。本ワークフローが要求する `pull-requests: write` / `contents: write` 権限はそのまま付与可能。将来 fork からの PR を本ワークフローの対象に含める場合は、`pull_request_target` トリガーへの切り替えと安全性レビューを別途行う必要がある。

### 4. groups の分割（patch / minor を別グループ化）

`groups` を patch / minor で別グループに分割し、major は groups 対象外として個別 PR 化する。

- npm: `production-patch` / `production-minor` / `development-patch` / `development-minor` の 4 グループ
- github-actions: `actions-patch` / `actions-minor` の 2 グループ

この分割により、patch のみを含むグループ PR では `dependabot/fetch-metadata` の `update-type` が必ず `version-update:semver-patch` となり、Decision §3 の auto-merge が安定発火する。minor グループの PR と major の個別 PR は手動レビュー対象となる。

### 5. cooldown の設定

全 ecosystem に以下を設定する:

```yaml
cooldown:
  semver-major-days: 14
  semver-minor-days: 7
  semver-patch-days: 3
  include: ["*"]
```

GitHub Advisory（CVE）由来のセキュリティ更新は cooldown を無視するため、脆弱性対応の即時性は維持される。

### 6. 既存設定の維持

`commit-message.prefix`（`chore(deps)` / `chore(ci)`）、`labels: [chore]`、`assignees: [kuairen-227]`、weekly schedule は維持する（CLAUDE.md のスコープ規約と整合）。

## Consequences

### ポジティブ

- タグ差し替えによる任意コード実行リスクが除去される（Decision §1）
- monorepo 全 workspace の依存更新が可視化される（Decision §2）
- patch の適用が人手を介さず CI ゲート経由で行われ、運用負荷が下がる（Decision §3）
- major の破壊的変更が個別 PR となり、レビューが埋もれない（Decision §4）
- 公開直後の悪性リリースに対する待機期間が確保される。CVE 対応の即時性は cooldown 仕様により維持される（Decision §5）

### ネガティブ / リスク

- SHA pin により action のバージョンが視覚的に追いにくくなる（コメントで version を併記して緩和）
- patch auto-merge が動作するためには main の **branch protection で必須チェックが設定済み**であることが前提となる。未設定の場合は `--auto` が即時マージとなりリスクが顕在化する（前提確認は本 ADR 適用直後の運用作業として実施する）
- cooldown により最新バージョンが取り込まれるまで最短 3 日のラグが発生する（CVE は cooldown 無視のため例外）

### 中立

- `dependabot/fetch-metadata` 自体も SHA pin で導入するため、今後のバージョン追従は dependabot 自身が行う
- patch 自動マージワークフローは Dependabot 公式の推奨パターン（GitHub Docs `Automating Dependabot with GitHub Actions`）に準拠
- major 個別 PR の運用コストは Dependabot の仕様（groups 対象外で別 PR）により自動化されており、追加設定は不要
