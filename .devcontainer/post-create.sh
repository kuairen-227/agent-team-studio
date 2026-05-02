#!/usr/bin/env bash
# DevContainer 作成・Rebuild 時に実行される初期化スクリプト。
# 詳細: docs/guides/development-tools.md

set -euo pipefail

# postgresql-client: AI / 人間が DB を psql で操作するための CLI
sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# ワークスペース依存関係
bun install
