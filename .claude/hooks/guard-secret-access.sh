#!/bin/bash
# PreToolUse(Bash) ガード: シークレットファイルの読取・環境変数のダンプを試みる
# Bash コマンドをブロックする（ADR-0039）。
#
# permissions.deny の Read(**/.env*) は Claude が認識するファイルコマンド（cat/head/
# tail/sed/grep）には効くが、`source .env` / `printenv` / `bun -e`・`node`・`python` 等が
# ファイルを直接開く経路には効かない（公式仕様）。本フックがその抜け道を決定論的に塞ぐ。
#
# 入力: CLAUDE_TOOL_INPUT（JSON, .command）。無ければ stdin の JSON（.tool_input.command）。
# 出力: 一致したら exit 2（ブロック、理由を stderr へ）。それ以外は exit 0。

STDIN_JSON=$(cat 2>/dev/null)
cmd=$(CLAUDE_TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}" STDIN_JSON="$STDIN_JSON" bun -e "
  const pick=(j)=>{try{const d=JSON.parse(j);return d.command||(d.tool_input&&d.tool_input.command)||'';}catch(_){return '';}};
  process.stdout.write(pick(process.env.CLAUDE_TOOL_INPUT||'')||pick(process.env.STDIN_JSON||'')||'');
" 2>/dev/null)

# 入力が取れない場合はフェイルオープン（他層: Read deny / egress firewall が backstop）。
[[ -z "$cmd" ]] && exit 0

# 安全なテンプレート（.env.example / .env.sample）は判定対象から除外する。
# 前後に単語境界を要求し、完全なトークン一致のみ除外する。末尾境界から `.` を外すことで
# 二重拡張子（.env.example.local 等）を除外せず後段の .env チェックで BLOCK させ、先頭境界で
# サフィックス偽装（.env.exampleproduction）も BLOCK する。境界文字（\1 / \3）は残す。
scan=$(printf '%s' "$cmd" | sed -E 's/(^|[^a-zA-Z0-9.])\.env\.(example|sample)([^a-zA-Z0-9.]|$)/\1\3/g')

deny() {
  echo "guard-secret-access: blocked — $1" >&2  # machine-readable（ログ・診断用）
  echo "シークレット保護のため拒否しました（ADR-0039）。値が必要なら .env.example / docs/guides/env.md を参照してください。" >&2  # human-readable（エージェントへの案内）
  exit 2
}

# .env および全変種（.env.local / .env.production / .env.keys ...）をファイル名トークンとして検出。
# `.environment` 等は .env の後ろが英数字のため一致しない。
# 注: .envrc（direnv）は意図的に対象外（本プロジェクトは direnv 未使用のため）。採用する場合は
# Read(**/.envrc) を deny に追加し、本パターンにも `.envrc` を加えることを検討する。
printf '%s' "$scan" | grep -Eiq '\.env([^a-zA-Z0-9]|$)' && deny "references a .env secret file"

# 環境変数のダンプ（printenv / 単体の env）。
# 副作用: 文字列・変数中に printenv/env という単語を含む正当なコマンド（echo "printenv" 等）も
# BLOCK される（誤検知率はほぼゼロ・fail-safe 寄り）。
printf '%s' "$scan" | grep -Eiq '(^|[^a-zA-Z0-9_])printenv([^a-zA-Z0-9_]|$)' && deny "printenv dumps environment variables"
# 単体の env（ダンプ）。env VAR=val cmd（実行）は ALLOW。flag（env -0/-u）や redirect（env 2>...）は
# ダンプとみなして BLOCK する。
printf '%s' "$scan" | grep -Eiq '(^|[;&|]|[[:space:]])env([[:space:]]*($|[|<>&;])|[[:space:]]+-|[[:space:]]+[0-9]+[<>])' && deny "bare 'env' dumps environment variables"

# プロセスの環境メモリ。
printf '%s' "$scan" | grep -Eiq '/proc/[^/]*/environ' && deny "reading /proc/*/environ exposes secrets"

exit 0
