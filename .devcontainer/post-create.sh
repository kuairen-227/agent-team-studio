#!/usr/bin/env bash
# DevContainer 作成時に 1 回だけ実行される初期化スクリプト。
# Rebuild Container 時にも再実行される。
# 詳細: docs/guides/development-tools.md

set -euo pipefail

# postgresql-client: AI / 人間が DB を psql で操作するための CLI
sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# ワークスペース依存関係
bun install
