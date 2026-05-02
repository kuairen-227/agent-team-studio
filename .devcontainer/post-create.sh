#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client

# ワークスペース依存関係
bun install
