#!/bin/bash
# cspell:ignore exampleproduction
# guard-secret-access.sh のユニットテスト（ADR-0039）。
# CI（.github/workflows/ci.yml の test ジョブ）と手元の両方で実行可能。
# 各ケースは CLAUDE_TOOL_INPUT にコマンドを与え、フックの exit code を検証する。
#   BLOCK = 2（シークレット読取・env ダンプを遮断）/ ALLOW = 0
set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/guard-secret-access.sh"
pass=0
fail=0

check() { # $1=説明 $2=期待exit $3=コマンド文字列
  local payload
  payload="$(bun -e 'process.stdout.write(JSON.stringify({command: process.argv[1]}))' "$3")"
  CLAUDE_TOOL_INPUT="$payload" bash "$HOOK" >/dev/null 2>&1
  local rc=$?
  if [[ "$rc" == "$2" ]]; then
    printf 'ok   (%s) %s\n' "$rc" "$1"
    pass=$((pass + 1))
  else
    printf 'FAIL (got %s, want %s) %s\n' "$rc" "$2" "$1"
    fail=$((fail + 1))
  fi
}

# --- BLOCK（exit 2）: シークレットファイルの読取 ---
check "cat .env"                      2 'cat .env'
check "cat nested .env.production"    2 'cat apps/api/.env.production'
check "cat .env.keys (private key)"   2 'cat .env.keys'
check "source .env"                   2 'source .env && bun run dev'
check "bun -e reads .env"             2 'bun -e "require(\"fs\").readFileSync(\".env\")"'
check "suffix-spoof .exampleproduction" 2 'cat .env.exampleproduction'
# --- BLOCK（exit 2）: 環境変数ダンプ ---
check "printenv"                      2 'printenv PATH'
check "bare env"                      2 'env'
check "env piped"                     2 'env | sort'
check "proc environ"                  2 'cat /proc/self/environ'

# --- ALLOW（exit 0）: 正当なコマンド・誤検知防止 ---
check "bun run dev"                   0 'bun run dev'
check "docker compose up"             0 'docker compose up -d'
check "read environment.ts"           0 'cat src/environment.ts'
check "env VAR=x prefix"              0 'env NODE_ENV=test bun test'
check "cat .env.example (template)"   0 'cat .env.example'
check "git status"                    0 'git status'

printf -- '---- pass=%s fail=%s\n' "$pass" "$fail"
[[ "$fail" == 0 ]] || exit 1
