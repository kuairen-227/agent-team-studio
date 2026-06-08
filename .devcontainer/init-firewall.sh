#!/bin/bash
# DevContainer egress allowlist firewall（ADR-0037 / Issue #271）
#
# default-deny で許可ドメインのみへの outbound を通す、自律実行時のネットワーク安全網。
# devcontainer.json の postStartCommand から sudo で実行する（毎起動時に再構成）。
# NET_ADMIN / NET_RAW capability が必要（docker-compose.yml の app.cap_add で付与）。
#
# allowlist を増やすときは下の `for domain in` ループに追記する。
# 一時的に firewall を外したい場合は `sudo iptables -P OUTPUT ACCEPT` で OUTPUT を開放する。
# 役割分担と運用は docs/guides/devcontainer.md「egress allowlist firewall」を参照。
#
# 構造は anthropics/claude-code 公式 DevContainer の init-firewall.sh を踏襲し、
# 本リポジトリ固有のドメイン（Groq / context7）と堅牢化（PR #287 レビュー反映）を加えている。

set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'        # Stricter word splitting

# filter テーブルのみフラッシュし、nat / mangle には一切触れない。
# 理由: Docker の組み込み DNS（127.0.0.11）は nat テーブルのルールで動くため、nat を
#       フラッシュすると名前解決が壊れる（curl が exit 6 = couldn't resolve で失敗する）。
#       本 firewall は egress 制御を filter テーブルだけで行うので nat の操作は不要。
iptables -F
iptables -X
ipset destroy allowed-domains 2>/dev/null || true

# 取得・解決フェーズは外向き通信が要るため、まず policy を ACCEPT に戻す。
# （手動再適用などで前回の DROP policy が残っていても、ここで開放してから組み直す）
# default DROP はすべての許可ルールを積んだ後、スクリプト末尾で設定する。
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# 許可ドメインが内部帯域へ解決された場合の DNS spoofing 対策。
# プライベート / ループバック / リンクローカルを ipset から除外する。
# （Docker subnet への許可は後段で HOST_NETWORK として明示付与する）
is_private_ip() {
    [[ "$1" =~ ^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.) ]]
}

# CIDR 対応の ipset を作成
ipset create allowed-domains hash:net

# GitHub の IP レンジを取得し集約して追加（gh / git / GitHub MCP の到達先）。
# -sf: HTTP エラー（429/503 等）でも非0終了させ、set -e で確実に止める。
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -sf https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    # IPv6 等の非 IPv4 CIDR はスキップ（GitHub meta は IPv6 も返す）
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        continue
    fi
    if is_private_ip "${cidr%%/*}"; then
        echo "WARN: Skipping private CIDR from GitHub meta: $cidr"
        continue
    fi
    ipset add --exist allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# その他の許可ドメインを解決して追加
#   registry.npmjs.org : bun install / npx 経由の MCP サーバ取得
#   api.anthropic.com  : Claude Code 本体 + アプリの LLM（既定プロバイダ）
#   api.groq.com       : 無料 LLM ルート（ADR-0029 / ADR-0034）
#   context7.com       : context7 MCP の実行時 API
#   sentry.io          : エラートラッキング（ADR-0035）
#   statsig.*          : Claude Code のテレメトリ
#   *.visualstudio.com : VS Code 拡張・更新の取得（marketplace / blob / update）
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "api.groq.com" \
    "context7.com" \
    "sentry.io" \
    "statsig.anthropic.com" \
    "statsig.com" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com"; do
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "ERROR: Failed to resolve $domain"
        exit 1
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
        ipset add --exist allowed-domains "$ip"
    done < <(echo "$ips")
done

# Docker subnet（app ↔ db）を許可するため、デフォルトルートのゲートウェイから /24 を導出。
# 複数デフォルトルート構成でも先頭のみ採用。Docker デフォルトの /24 サブネットを仮定。
HOST_IP=$(ip -4 route show default | awk '/^default/ {print $3; exit}')
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# --- 許可ルールを先に全て組み立て、default DROP は最後に設定する ---
# （DROP を先に設定すると、ESTABLISHED 許可を積むまでの間に既存接続が切れる窓ができる）

# localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 確立済み接続
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# DNS（udp + tcp。512 バイト超の応答や DNSSEC は TCP にフォールバックする）
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT  -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT  -p tcp --sport 53 -m state --state ESTABLISHED -j ACCEPT

# SSH（git over ssh 等）
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT  -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT

# Docker subnet（app ↔ db）
iptables -A INPUT  -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# 許可ドメインへの外向き通信
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# それ以外の外向きは即時フィードバックのため明示 REJECT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# 最後に default policy を DROP に（ここまでで許可ルールは揃っている）
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

echo "Firewall configuration complete"
echo "Active OUTPUT rules:"
iptables -L OUTPUT -n -v

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
