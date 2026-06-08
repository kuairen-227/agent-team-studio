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
# 本リポジトリ固有のドメイン（Groq / context7）を allowlist に追加している。

set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'        # Stricter word splitting

# 1. フラッシュ前に Docker の内部 DNS（127.0.0.11）の NAT ルールを退避する。
#    これを保全しないとコンテナ名（db 等）の名前解決が壊れる。
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# 既存ルールと ipset を削除
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Docker 内部 DNS 解決のルールのみ選択的に復元
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# 制限をかける前に DNS / SSH / localhost を許可する
# 外向き DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# DNS 応答の受信
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# 外向き SSH（git over ssh 等）
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# SSH 応答の受信
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# CIDR 対応の ipset を作成
ipset create allowed-domains hash:net

# GitHub の IP レンジを取得し集約して追加（gh / git / GitHub MCP の到達先）
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
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
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# その他の許可ドメインを解決して追加
#   registry.npmjs.org : bun install / npx 経由の MCP サーバ取得
#   api.anthropic.com  : Claude Code 本体 + アプリの LLM（既定プロバイダ）
#   api.groq.com       : 無料 LLM ルート（ADR-0029 / ADR-0034）
#   context7.com       : context7 MCP の実行時 API
#   sentry.io          : エラートラッキング（ADR-0035）
#   statsig.*          : Claude Code のテレメトリ
#   *.visualstudio.com : VS Code 拡張の取得・更新
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
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        echo "Adding $ip for $domain"
        ipset add allowed-domains "$ip"
    done < <(echo "$ips")
done

# デフォルトルートからホストネットワークを取得（app ↔ db の Docker subnet を許可するため）
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# 残りの iptables ルール（Docker subnet 内＝db への接続を許可）
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# デフォルトポリシーを DROP に
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# 確立済み接続を許可
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 許可ドメインへの外向き通信のみ許可
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# それ以外の外向きは即時フィードバックのため明示 REJECT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# GitHub API への到達を確認
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
