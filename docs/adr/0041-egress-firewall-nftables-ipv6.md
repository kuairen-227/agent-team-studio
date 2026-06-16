# 0041. egress firewall の nftables 移行と IPv6 egress 方針（ADR-0037 一部再評価）

## Status

accepted

- 作成日: 2026-06-16
- 関連: [ADR-0037](./0037-ai-execution-sandbox-policy.md)（前提・本 ADR で firewall 実装方式を一部 supersede）, [ADR-0024](./0024-playwright-mcp-for-ai-verification.md)（Playwright MCP = Evaluator の検証基盤）, [ADR-0038](./0038-autonomous-agent-loop-adoption.md)（自律エージェントループ）, Issue #306, Issue #289（前提整備の分離元）

## Context

ADR-0037 で導入した egress allowlist firewall（`.devcontainer/init-firewall.sh`、iptables + ipset・default-deny）は **IPv4 only** で、`ip6tables` を張っていない。これに起因して 2 つの課題が顕在化した（原因分析: `_dev/289-playwright-download-network-postmortem.md`）。

1. **(A) Playwright Chromium 取得の不安定**: コンテナ eth0 にリンクローカル等の IPv6 アドレスは付くため resolver が AAAA を返すが、グローバル IPv6 egress 経路は無い（Docker bridge は既定 v4 only・ホスト側 v6 アップリンク不在）。downloader が AAAA を先に掴み `ENETUNREACH` で固まる。暫定回避は当該ホストを IPv4 で `/etc/hosts` に固定する手動セッション措置で、コンテナ再起動で消える。

2. **(B) IPv6 egress バイパスの余地**: iptables は IPv4 パケットのみを統治し、IPv6 は別系統（ip6tables）の管轄。現状 ip6tables 無設定のため、IPv6 egress 経路が存在すれば allowlist を素通りできる。今は経路が無く偶然塞がっているだけで、firewall が enforce する保証ではない。default-deny の保証は「最も弱い経路の強さ」しか持たない。

(A) と (B) は「IPv6 が中途半端に有効」という単一原因の表裏。egress を開ける方向（A）と閉じる方向（B）に見えるが、根は同じ。恒久対応の方針を確定する。

## Considered Alternatives

### 論点 1: firewall ツール（IPv6 をどう統治するか）

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | iptables 維持 + ip6tables を併用 | 却下 — v4/v6 を別ツール・別ルールセットで二重管理。GitHub meta の v6 CIDR 集約・AAAA 解決を別系統で抱え実装量が増える。`anthropics/claude-code` 公式 init-firewall.sh も IPv6 を一切扱っておらず（v4 only・IPv6 CIDR で `exit 1`）、踏襲元に IPv6 の前例は無い |
| B | **nftables（inet ファミリ）へ移行** | **採用** — 1 ルールセットで v4/v6 を同時統治。ルールセットを 1 トランザクションで atomic 差し替えでき、iptables 版の「取得〜DROP 設定の間に egress が開く窓」を解消。ipset 依存も排除（ネイティブ set）。iptables 自体メンテナンスモードで distro も nft バックエンドへ移行済み |

> nftables 採用に伴う Docker 連携の制約: `nft flush ruleset` は使わない。Docker は自身の nat / filter ルールも nftables バックエンドに持つため、全 flush で組み込み DNS（127.0.0.11）や bridge が壊れる。専用テーブル `inet egress_fw` のみを atomic に差し替え、Docker のテーブルには触れない。

### 論点 2: IPv6 egress の姿勢

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | IPv6 スタックを無効化（sysctl `disable_ipv6`） | 却下 — (A)(B) を最小変更で潰せるが、nftables 採用で構造的に v6 統治が可能になるため、スタックを消すより firewall で統治する方が将来の dual-stack 移行を妨げない |
| B | **v6 は有効化せず inet で default-deny** | **採用** — v6 egress は通さないが、漏れた v6 パケットは許可ルール（ip daddr 系）に一致せず reject / policy drop へ落ちる。(B) のバイパス余地を経路の有無に依らず塞ぐ。攻撃面を増やさない（ADR-0037「allowlist 最小限」と整合） |
| C | v6 egress を有効化し v6 も allowlist（dual-stack） | 却下（再検討契機付き） — 許可先は全て dual-stack で v4 を捨てないため v4 を落とせず、v6 allowlist は v4 に**上乗せ**で増えるだけ（allowlist は単純化せず複雑化）。v6 を実際に通すにはホストの v6 アップリンクが要り、プロジェクト管理外の環境に成否が依存する。現状 v6-only の許可先は無く forcing function が無い |

### 論点 3: (A) ダウンロード安定化の手段

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | **解決順を IPv4 優先（`--dns-result-order=ipv4first`）** | **採用** — IPv6 の禁止ではなく解決順の優先指定。既に動く v4 経路を確実に使わせる。ホスト非依存・IP 変動に強い。`devcontainer.json` の `containerEnv` で `NODE_OPTIONS` を**コンテナ全体**に設定（v6 経路欠如はコンテナの性質のため。bun は NODE_OPTIONS を無視し app 実行には影響しない） |
| B | 対象ホストを IPv4 で `/etc/hosts` に恒久登録 | 却下 — ホスト名・IP 変動に弱く、対象ホスト分のメンテナンス負債を抱える |

## Decision

1. **egress firewall を iptables + ipset から nftables（inet ファミリ）へ移行する。** 専用テーブル `inet egress_fw` を 1 つの `nft -f` トランザクションで atomic に差し替える。`nft flush ruleset` は使わず Docker のテーブルには触れない。ipset 依存を排除する。ADR-0037 の「iptables パターン踏襲」部分を本 ADR で supersede する（egress allowlist・default-deny・多重防御の方針自体は不変）。

2. **IPv6 egress は有効化せず、inet ルールセットで default-deny する（論点 2-B）。** 許可は IPv4 のみ。v6 パケットは許可ルールに一致せず reject / policy drop へ落ちるため、v6 経路の有無に関わらず allowlist を素通りできない。

3. **dual-stack 化（論点 2-C）は見送り、再検討契機を定める。** 許可先に v6-only（A レコードを持たない）宛先が現れる、または v6-only ネットワークでの実行が必要になった時点で再評価する。nftables へ移行済みのため、その際は v6 set と AAAA 解決を追加する局所的増分で済む。

4. **(A) は Node の DNS 解決順を IPv4 優先に固定して解決する（論点 3-A）。** `devcontainer.json` の `containerEnv` で `NODE_OPTIONS="--dns-result-order=ipv4first"` をコンテナ全体に設定し、手動 `/etc/hosts` 措置を撤廃する。v6 egress 経路の欠如はそのコマンド固有でなくコンテナの性質のため、node/npx の取得全般を対象にする（bun は NODE_OPTIONS を無視するため app 実行には影響しない。ランタイムは ADR-0008 で bun に固定済み）。Playwright 取得経路（`cdn.playwright.dev` / `playwright.download.prss.microsoft.com` / `storage.googleapis.com`）は allowlist に追加する。

## Consequences

- v4/v6 が 1 ルールセットで統治され、IPv6 egress バイパスの余地が経路の有無に依らず塞がる。Docker 設定（`enable_ipv6`）やホストの v6 アップリンクの変化に対しても default-deny が保たれる。
- atomic 差し替えにより、ADR-0037 が欠点として挙げた「取得〜DROP 設定の間に egress が一時開放される窓」が解消される。
- `input` チェーンも `policy drop` とし、inbound は loopback・established/related・Docker subnet（`HOST_NETWORK`）発のみ許可して他は drop する。app↔db 間通信と `devcontainer.json` の `forwardPorts`（VS Code のポート転送、Docker gateway 経由で `HOST_NETWORK` 内から到達）はこのルールで通る。`HOST_NETWORK` は Docker bridge が返すサブネット CIDR を前提とし、起動時に検出値をログ出力する（万一 `/32` 等が返る環境では db からの inbound が遮断され得るため、この前提はローカル実機検証で確認する）。標準的な Docker bridge では subnet CIDR が返るため `/32` は未観測であり、投機的なフォールバックは作り込まない（YAGNI）。実機検証で `/32` が観測された時点で、subnet 手動指定 option の追加を follow-up Issue として対応する。
- フェイルクローズ（`init-firewall.sh` の適用失敗時にコンテナを停止させる）の未対応状態は ADR-0037 と不変。nftables 移行後も「適用が失敗すれば firewall なしで起動する」リスクは変わらないため、追加要否は #270 の設計時に引き続き再評価する。
- 起動時の自己検証は **egress 経路のみ**を対象とする（`example.com` が REJECT＝許可外の遮断、`api.github.com` が到達＝許可先の疎通）。`example.com` は IANA 特別用途ドメインで実トラフィックの許可レンジと重複しない canary として用いる。app↔db の inbound 疎通はこの検証の対象外で、別途ローカル実機検証で確認する。
- ipset 依存が消え、firewall が nft 1 ツールに集約される。`Dockerfile` の依存は `iptables ipset` → `nftables` に変わる。
- `storage.googleapis.com` は広域共有ドメインで、IP ベース許可のため同 IP レンジの他バケットへの egress も開く。allowlist 最小限の原則からは広いが、Playwright 本体 zip のリダイレクト先として必要なため受容する。これは ADR-0037 が挙げる「広域ドメイン許可は domain fronting 等で回避され得る」既知リスクの一例であり、本 ADR も同方針を継承したうえで、許可先のうち最も広いこの 1 ドメインに限りリスクを受容する。CDN の IP ローテートで許可先が REJECT され得る制約は iptables 版と同様（緩和: `sudo bash .devcontainer/init-firewall.sh` 再適用）。
- `--dns-result-order=ipv4first` は解決順の優先指定であり IPv6 を禁止しない。v6 が実際に到達可能な宛先では v6 も使われ得る。
- nftables / nf_tables カーネルモジュールに依存する。実機検証はローカル WSL2 DevContainer で行う必要がある（本移行は Docker・NET_ADMIN を伴うため、Web リモート実行環境では実行検証できない）。
- 一時的に firewall を外す手順が `sudo iptables -P OUTPUT ACCEPT` から `sudo nft delete table inet egress_fw` に変わる。`docs/guides/devcontainer.md` を更新する。
- Claude Code on the web（リモート実行環境）は別途 network policy が egress を統治しており、本 firewall は **ローカル DevContainer** の egress を補完する位置づけ（ADR-0037 と不変）。
