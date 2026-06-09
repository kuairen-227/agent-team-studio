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
check "cat .env.local"                2 'cat .env.local'
check "cat nested .env.production"    2 'cat apps/api/.env.production'
check "cat .env.keys (private key)"   2 'cat .env.keys'
check "source .env"                   2 'source .env && bun run dev'
check "bun -e reads .env"             2 'bun -e "require(\"fs\").readFileSync(\".env\")"'
check "node -e reads .env"            2 'node -e "require(\"fs\").readFileSync(\".env\")"'
check "python3 -c reads .env"         2 'python3 -c "open(\".env\").read()"'
check "suffix-spoof .exampleproduction" 2 'cat .env.exampleproduction'
check "double-ext .example.local"     2 'cat .env.example.local'
check "double-ext .sample.production" 2 'cat .env.sample.production'
# --- BLOCK（exit 2）: 環境変数ダンプ ---
check "printenv"                      2 'printenv PATH'
check "bare env"                      2 'env'
check "env piped"                     2 'env | sort'
check "env -0 flag"                   2 'env -0'
check "env redirect 2>"               2 'env 2>/dev/null'
check "proc environ"                  2 'cat /proc/self/environ'
# --- BLOCK（exit 2）: 既知の trade-off（ADR-0039・意図的な fail-safe）---
# .env を引数で参照する git/gh コマンドも fail-safe でブロックされる。
# 正当な用途（commit メッセージ等）は -F ファイル経由で回避する。
check "git log --grep mentions .env"  2 'git log --grep=.env.production'
# process.env.X アクセスもブロック（node -e 'console.log(process.env.SECRET)' の exfil を防ぐ）。
check "bun -e process.env access"     2 'bun -e "console.log(process.env.NODE_ENV)"'
# FS 列挙でシークレットファイルを探す経路もブロック。
check "find -name .env glob"          2 'find . -name .env*'

# --- ALLOW（exit 0）: 正当なコマンド・誤検知防止 ---
check "bun run dev"                   0 'bun run dev'
check "docker compose up"             0 'docker compose up -d'
check "read environment.ts"           0 'cat src/environment.ts'
check "env VAR=x prefix"              0 'env NODE_ENV=test bun test'
check "cat .env.example (template)"   0 'cat .env.example'
check "cat nested .env.example"       0 'cat apps/api/.env.example'
check "cat .env.sample (template)"    0 'cat .env.sample'
check "git status"                    0 'git status'

printf -- '---- pass=%s fail=%s\n' "$pass" "$fail"
[[ "$fail" == 0 ]] || exit 1
