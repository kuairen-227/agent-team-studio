# 0037. AI 実行のサンドボックス方針（Bash サンドボックス見送り・DevContainer egress allowlist 採用）

## Status

accepted

- 作成日: 2026-06-08
- 関連: [ADR-0007](./0007-ai-driven-dev-architecture.md)（前提：品質保証 3 層・permissions）, [ADR-0016](./0016-devcontainer-integration.md)（前提：DevContainer 隔離）, Issue #271, Issue #269（親トラッカ）, Issue #270（後続：Plan/Verify 自律ループ）

## Context

AI 駆動開発ハーネスの棚卸し（`docs/guides/ai-driven-development.md`）で、Claude Code の tool 実行サンドボックスが **未設定** と判明した（#271）。実態の隔離は **DevContainer + `permissions.deny`** が担っている。

一方 #269 / #270 で、長時間稼働アプリ向けの **Plan/Verify 自律ループ**（Planner / Implementer / Verifier）を構想している。無人・長時間の自律実行に近づくほど、暴走時の隔離（安全網）、とりわけ **ネットワーク経由のデータ持ち出し（exfiltration）防止** の価値が上がる。自律ループの設計（#270）に着手するこのタイミングで、安全網の方針を確定する必要がある。

決めるべき論点は 2 つ:

1. Claude Code の **Bash サンドボックス**（bubblewrap / Seatbelt）を本リポジトリで設定するか
2. **ネットワーク egress** の安全網をどう張るか

本リポジトリは非特権の **DevContainer** で動く点が判断の前提になる。

## Considered Alternatives

### 論点 1: Claude Code Bash サンドボックス

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 非特権 DevContainer 内で nested 有効化（`enableWeakerNestedSandbox`） | 却下 — 非特権コンテナでは bubblewrap が新規 `/proc` を mount できず、`enableWeakerNestedSandbox: true`（コンテナ既存 `/proc` を bind-mount）が必須。これは「セキュリティを著しく弱める」設定。加えて `gh` / `docker` 等の非互換で `excludedCommands` が増え隔離がなし崩しになり、DevContainer と二重で増分が小さい |
| B | DevContainer を特権化（`--privileged`）して nested を正常動作させる | 却下 — `--privileged` は外側コンテナの隔離境界をほぼ無効化する。強い実境界（DevContainer）を捨てて重複する弱い内境界を立てる本末転倒で、攻撃面が拡大する |
| C | Bash サンドボックスは見送る | **採用** — FS 隔離・認証保護・危険コマンド遮断は DevContainer（ephemeral）+ `permissions.deny` + secretlint が既に担う。Bash サンドボックス固有の増分は本環境では小さい |

### 論点 2: ネットワーク egress 制御

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | egress 制御なし（現状） | 却下 — 自律実行時に任意ドメインへの outbound が開いたままで、exfiltration 経路が残る |
| B | Claude Code サンドボックスの network 層のみ利用 | 却下 — network proxy / socat が bubblewrap 機構に依存するため、論点 1-A の nested 問題（弱体化必須）を引きずる |
| C | DevContainer の egress allowlist firewall（iptables + ipset・default-deny・`NET_ADMIN` / `NET_RAW`） | **採用** — 限定 capability で実現でき `--privileged` 不要。`anthropics/claude-code` 公式 DevContainer の実証済みパターン。OS レベルで子プロセスまで強制する |

## Decision

1. **Claude Code Bash サンドボックス（bubblewrap nested）は見送る。** FS 隔離・認証保護・危険操作の遮断は引き続き DevContainer + `permissions.deny` + secretlint + リモート ephemeral 実行環境が担う。

2. **ネットワークの安全網は DevContainer の egress allowlist firewall で導入する。**
   - `.devcontainer/init-firewall.sh`: iptables + ipset で **default-deny**（OUTPUT は許可ドメインのみ）。`postStartCommand` から sudo 実行し、毎起動時に再構成する。
   - `docker-compose.yml` の `app` サービスに `cap_add: [NET_ADMIN, NET_RAW]` を付与（`--privileged` は使わない）。`db` サービスには付与しない（コンテナ内通信のみで外向き egress 制御が不要なため）。
   - 許可ドメイン allowlist: GitHub（`api.github.com/meta` の web/api/git レンジ）/ npm レジストリ / Anthropic API / Groq / Sentry / context7 / VS Code marketplace。DNS・SSH・loopback・Docker ネットワーク subnet（app ↔ db）を許可。allowlist は最小限とし、Claude Code のテレメトリ（statsig）等の非必須ドメインは含めない。

3. **役割分担**（多重防御の分担を明確化）:

   | レイヤ | 担当 |
   | --- | --- |
   | 実行環境隔離（FS・プロセス） | DevContainer（ephemeral）/ リモート Web 実行環境 |
   | 危険コマンド・直接 egress の遮断 | `permissions.deny`（`rm -rf` / `force push` / `.env` 読取 等）。`curl` / `wget` も deny し、Claude tool レベルでの直接 egress を遮断 → OS レベルの firewall と多重防御を形成（[ADR-0007](./0007-ai-driven-dev-architecture.md) 品質保証層の Security 版）。`.env` 読取の deny 強化・サブプロセスバイパス対策は [ADR-0039](./0039-secret-read-guard.md) で拡張 |
   | 機密情報の検出 | secretlint |
   | **ネットワーク egress** | **本 firewall（allowlist）** |

4. **再検討契機**:
   - DevContainer を使わない実行経路（ホスト直 / 別環境）へ移行する場合は OS サンドボックス（Seatbelt / bubblewrap）を再評価する。
   - 自律ループ（#270）の実装着手時に、ループが必要とする outbound ドメインを精査し allowlist を確定する。

## Consequences

- default-deny のため、allowlist に漏れがあると DevContainer 内の outbound（`bun install` / `gh` / Claude Code / 各 LLM API）が遮断される。新規 outbound 先が増えたら `init-firewall.sh` の allowlist 更新が必要。手順は `docs/guides/devcontainer.md` に記載する。
- firewall は `postStartCommand` で毎起動時に再構成される。GitHub の IP レンジは起動時に `api.github.com/meta` から再取得するため、レンジ変動に追従する反面、起動時に GitHub への到達が必要になる。
- `app` コンテナに `NET_ADMIN` / `NET_RAW` を付与する。`--privileged` より遥かに限定的だが、capability 追加自体は攻撃面をわずかに広げる。
- 組み込みプロキシは TLS を検査せず hostname ベースで許可するため、広域ドメイン許可は domain fronting 等で回避され得る（公式サンドボックスと同じ制約）。allowlist は最小限に保つ。
- firewall は起動時に一度だけ `dig` で IP を解決するため、起動後に CDN 等が IP をローテートすると許可先への接続が REJECT され得る（長時間起動・自律ループ #270 で顕在化しやすい）。緩和: `sudo bash .devcontainer/init-firewall.sh` での再適用、または Rebuild Container。
- firewall は許可リスト取得のため、冒頭で policy を一旦 ACCEPT に戻してから default-deny を組み立てる。この「取得〜DROP 設定」の間は outbound が一時的に開放される窓が存在する（allowlist を外部から取得する設計上、不可避）。※ [ADR-0041](./0041-egress-firewall-nftables-ipv6.md) の nftables 移行（ルールセットを 1 トランザクションで atomic 差し替え）でこの窓は解消済み。
- `postStartCommand` が失敗した場合、実機（#287）で VS Code は **コンテナを継続起動する**ことを確認した（"Skipping any further user-provided commands" と表示しつつコンテナは稼働し、ターミナル接続も可能）。つまり firewall 構成に失敗すると **firewall 無しで起動し得る**。フェイルクローズ（適用失敗時にコンテナ停止）や起動ヘルスチェックの追加要否は #270（自律ループ＝無人実行）の設計時に再評価する。
- firewall スクリプトは image に COPY せず、`postStartCommand` が bind mount 上の実ファイル（`.devcontainer/init-firewall.sh`）を直接実行する。当初は `/usr/local/bin` への image COPY 方式を採ったが、`.dockerignore` の再包含・ビルドキャッシュ・パス所有権の影響で **image に焼かれた実体が想定と異なるスクリプトに差し替わる事故**が実機検証（#287）で発生したため、ワークスペースの実ファイルを直接走らせる方式に変更した。allowlist 編集が Rebuild 不要で即反映される副次的利点もある。
- 実機検証はローカル DevContainer（WSL2）で完了（#287）。default-deny の許可外拒否（`example.com` が REJECT）・許可先到達（`api.github.com`）・Docker subnet 許可（app ↔ db）・allowlist 登録を確認。個別ドメインの解決失敗は WARN スキップ（致命にしない）で、解決できたドメインで firewall を起動する。
- allowlist から除外した Claude Code のテレメトリ／フィーチャーフラグ（statsig）は、ブロックされても Statsig がデフォルト値へフォールバックするため graceful に degrade する。本環境で機能ごとの個別検証は行っていないが、コア機能・LLM 実行・git/PR 操作はテレメトリに依存しないため機能影響なしと判断した。自律ループ（#270）設計時に必要性を再評価する。
- Claude Code on the web（リモート実行環境）では別途 network policy が egress を統治しており、本 firewall は **ローカル DevContainer** の egress を補完する位置づけ。
- `docs/guides/ai-driven-development.md` の施策インベントリ「サンドボックス＝未設定」を本決定に合わせて更新する。
