#!/bin/bash
# DevContainer egress allowlist firewall（nftables 版 / ADR-0037 + ADR-0041 / Issue #271 #306）
#
# default-deny で許可ドメインのみへの outbound を通す、自律実行時のネットワーク安全網。
# devcontainer.json の postStartCommand から sudo で実行する（毎起動時に再構成）。
# NET_ADMIN / NET_RAW capability が必要（docker-compose.yml の app.cap_add で付与）。
#
# nftables を採用する理由（ADR-0041）:
#   - inet ファミリの 1 ルールセットで IPv4 と IPv6 を同時に統治する。IPv6 egress は
#     有効化しない（v4 だけを allowlist 許可）が、v6 パケットは許可ルールに一致せず
#     policy drop / reject へ落ちるため、v6 経路が存在しても allowlist を素通りできない。
#   - ルールセットを 1 トランザクションで atomic に差し替えるため、iptables 版にあった
#     「取得〜DROP 設定の間に egress が開く窓」が存在しない。
#   - ipset 依存を排除（nft のネイティブ set で代替）。
#
# Docker 連携の重要点:
#   `nft flush ruleset` は使わない。Docker は自身の nat / filter ルールも nftables バックエンド
#   （iptables-nft）に持つため、全 ruleset を flush すると組み込み DNS（127.0.0.11）や bridge が
#   壊れる。本 firewall は専用テーブル `inet egress_fw` だけを atomic に差し替え、Docker の
#   テーブルには一切触れない。
#
# allowlist を増やすときは下の `for domain in` ループに追記する。
# 一時的に firewall を外したい場合は `sudo nft delete table inet egress_fw`（次回起動で再構成）。
# 役割分担と運用は docs/guides/devcontainer.md「egress allowlist firewall」を参照。

set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'        # Stricter word splitting

# 許可ドメインが内部帯域へ解決された場合の DNS spoofing 対策。
# プライベート / ループバック / リンクローカルは allowlist から除外する。
# （Docker subnet への許可は後段で HOST_NETWORK として明示付与する）
is_private_ip() {
    [[ "$1" =~ ^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.) ]]
}

# 許可する IPv4 アドレス／CIDR を収集する配列。
allowed_ips=()

# GitHub の IP レンジを取得し集約して追加（gh / git / GitHub MCP の到達先）。
# -sf: HTTP エラー（429/503 等）でも非0終了させ、set -e で確実に止める。
echo "Fetching GitHub IP ranges..."
if ! gh_ranges=$(curl -sf https://api.github.com/meta) || [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    echo "  DNS check    : $(dig +short api.github.com A 2>&1 | head -3)"
    echo "  Default route: $(ip -4 route show default 2>&1)"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    # IPv6 等の非 IPv4 CIDR はスキップ（GitHub meta は IPv6 も返すが allowlist は v4 のみ）
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        continue
    fi
    if is_private_ip "${cidr%%/*}"; then
        echo "WARN: Skipping private CIDR from GitHub meta: $cidr"
        continue
    fi
    allowed_ips+=("$cidr")
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# その他の許可ドメインを解決して追加
#   registry.npmjs.org : bun install / npx 経由の MCP サーバ取得
#   api.anthropic.com  : Claude Code 本体 + アプリの LLM（既定プロバイダ）
#   api.groq.com       : 無料 LLM ルート（ADR-0029 / ADR-0034）
#   context7.com       : context7 MCP の実行時 API
#   sentry.io          : エラートラッキング（ADR-0035）
#   *.visualstudio.com : VS Code marketplace（拡張のダウンロード）
#   vscode.blob.core.windows.net : 拡張バイナリの blob ストレージ（windows.net 系・別系統）
#   update.code.visualstudio.com : VS Code 本体の更新
#   cdn.playwright.dev / playwright.download.prss.microsoft.com / storage.googleapis.com :
#     @playwright/mcp の Chromium 取得（ADR-0024）。本体 zip は cdn.playwright.dev から
#     storage.googleapis.com へ 307 リダイレクトされるためリダイレクト先まで許可する
#     （storage.googleapis.com は広域共有ドメインで許可も広くなる点は ADR-0041 で受容）。
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "api.groq.com" \
    "context7.com" \
    "sentry.io" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com" \
    "cdn.playwright.dev" \
    "playwright.download.prss.microsoft.com" \
    "storage.googleapis.com"; do
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        # 個別ドメインの解決失敗は致命としない（CNAME のみ応答・一時的失敗・任意ドメイン等）。
        # WARN を出してスキップし、解決できた他ドメインで firewall を起動する。
        # 全ドメインが失敗した場合は後段の allowlist 空ガードが捕捉する。
        echo "WARN: Failed to resolve $domain; skipping (firewall continues without it)"
        echo "  DNS hint: $(dig +short "$domain" 2>&1 | head -3)"
        continue
    fi

    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
            echo "WARN: Skipping invalid IP for $domain: $ip"
            continue
        fi
        if is_private_ip "$ip"; then
            echo "WARN: Skipping private IP for $domain: $ip"
            continue
        fi
        allowed_ips+=("$ip")
    done < <(echo "$ips")
done

# allowlist が空のまま default-deny にすると全 egress を塞いでしまう（bun install / LLM API が
# 謎の失敗をする）。最低 1 件の登録を保証してから DROP 設定へ進む。
if [ "${#allowed_ips[@]}" -lt 1 ]; then
    echo "ERROR: allowed-domains set is empty; aborting before applying default-deny"
    exit 1
fi

# 重複を排除して nft の set 要素文字列を組み立てる（auto-merge で重複・隣接は吸収するが
# 念のため sort -u で正規化する）。
mapfile -t uniq_ips < <(printf '%s\n' "${allowed_ips[@]}" | sort -u)
echo "allowed-domains entries: ${#uniq_ips[@]}"
elements=$(printf '%s, ' "${uniq_ips[@]}")
elements=${elements%, }

# Docker subnet（app ↔ db）を許可する。/24 固定は仮定せず、デフォルトルートの出力 interface の
# 実 CIDR をそのまま使う（カスタムサブネット /16 等にも追従）。
HOST_IF=$(ip -4 route show default | awk '/^default/ {for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}')
HOST_NETWORK=$(ip -4 addr show "${HOST_IF:-eth0}" | awk '/inet / {print $2; exit}')
if [ -z "$HOST_NETWORK" ]; then
    echo "ERROR: Failed to detect host network CIDR"
    echo "  ip route: $(ip -4 route show default 2>&1)"
    exit 1
fi
echo "Host network detected as: $HOST_NETWORK (iface ${HOST_IF:-eth0})"

# --- 専用テーブル inet egress_fw を atomic に差し替える ---
# 先頭の `table inet egress_fw`（空宣言）は未存在時に作成して直後の delete を冪等にするための
# イディオム。delete → 完全再定義までを 1 つの nft -f トランザクションで適用するため、適用途中で
# egress が開く窓は生じない。inet ファミリなので IPv4（ip）/ IPv6（ip6）の両方をこの 1 テーブルが扱う。
#
# v6 の扱い: 許可ルールは ip（v4）のみ。v6 パケットは ip daddr 系ルールに一致せず、末尾の
# reject（policy drop が backstop）へ落ちる → v6 egress は経路の有無に関わらず default-deny。
nft -f - <<EOF
table inet egress_fw
delete table inet egress_fw
table inet egress_fw {
    set allowed_v4 {
        type ipv4_addr
        flags interval
        auto-merge
        elements = { ${elements} }
    }

    chain input {
        type filter hook input priority 0; policy drop;
        iifname "lo" accept
        ct state established,related accept
        ip saddr ${HOST_NETWORK} accept
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy drop;
        oifname "lo" accept
        ct state established,related accept
        udp dport 53 accept
        tcp dport 53 accept
        tcp dport 22 accept
        ip daddr ${HOST_NETWORK} accept
        ip daddr @allowed_v4 accept
        # 許可外は即時フィードバックのため明示 reject（v4/v6 両方。policy drop が backstop）
        reject with icmpx type admin-prohibited
    }
}
EOF

echo "Firewall configuration complete"
echo "Active ruleset (inet egress_fw):"
nft list table inet egress_fw

# 検証: 許可外（example.com）は接続自体が REJECT されるはず（HTTP ステータスでなく到達可否を見るため -s のみ）。
#       許可先（api.github.com）は到達できるはず（-sf で HTTP エラーも失敗扱いにする）。
echo "Verifying firewall rules..."
if curl --connect-timeout 5 -s https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# GitHub API への到達を確認
if ! curl --connect-timeout 5 -sf https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
