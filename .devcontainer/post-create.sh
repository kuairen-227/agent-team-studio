#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# named volume で永続化する gh CLI 認証情報の保存先を node 所有で用意する。
sudo install -d -o node -g node -m 700 /home/node/.config /home/node/.config/gh

bun install

# Playwright MCP（@playwright/mcp）が利用する Chromium バイナリと
# Linux 依存パッケージを事前に取得する（ADR-0024）。
# E2E 用 `playwright` の package.json への追加は別 ADR で扱うため、
# ここでは MCP 経由の AI 検証用途に限定する。
sudo npx --yes playwright install-deps chromium
npx --yes playwright install chromium
