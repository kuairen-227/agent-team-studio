#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# named volume で永続化する gh CLI 認証情報の保存先を node 所有で用意する。
sudo install -d -o node -g node -m 700 /home/node/.config /home/node/.config/gh

bun install

# @playwright/mcp が使う Chrome for Testing と system 依存パッケージを事前取得（ADR-0024）。
# IPv6 egress 経路の無い環境（Docker bridge は既定 v4 only）では downloader が AAAA を先に掴み
# ENETUNREACH で固まるため、Node の DNS 解決順を IPv4 優先に固定する（ADR-0041 / Issue #306）。
# これは IPv6 の禁止ではなく解決順の優先指定で、既に動く v4 経路を確実に使わせるだけ。
sudo npx --yes playwright install-deps chromium
NODE_OPTIONS="--dns-result-order=ipv4first" npx --yes @playwright/mcp@latest install-browser chrome-for-testing
