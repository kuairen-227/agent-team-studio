#!/bin/bash
# TS/TSX 編集後に biome で自動修正する PostToolUse hook
f=$(node -e "try{const d=JSON.parse(process.env.CLAUDE_TOOL_INPUT||'{}');console.log(d.file_path||'')}catch(e){}" 2>/dev/null)
if [[ "$f" =~ \.(ts|tsx)$ ]]; then
  root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null)
  [[ -n "$root" ]] && cd "$root" && bunx biome check --write "$f" 2>&1 | tail -5
fi
exit 0
