#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# named volume で永続化する gh CLI 認証情報の保存先を node 所有で用意する。
sudo install -d -o node -g node -m 700 /home/node/.config /home/node/.config/gh

bun install
