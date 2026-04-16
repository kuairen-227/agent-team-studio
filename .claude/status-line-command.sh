#!/bin/bash
# Claude Code statusline script
# Displays /status equivalent info: model, context usage, session info

input=$(cat)

# Model display name
model=$(echo "$input" | jq -r '.model.display_name // "Unknown Model"')

# Context window usage
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
remaining_pct=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Token counts
input_tokens=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // empty')
output_tokens=$(echo "$input" | jq -r '.context_window.current_usage.output_tokens // empty')

# Session name
session_name=$(echo "$input" | jq -r '.session_name // empty')

# Version
version=$(echo "$input" | jq -r '.version // empty')

# Output style
output_style=$(echo "$input" | jq -r '.output_style.name // empty')

# Build status line parts
parts=()

# Model
parts+=("$(printf '\033[1;36m%s\033[0m' "$model")")

# Context usage
if [ -n "$used_pct" ] && [ -n "$remaining_pct" ]; then
  ctx_used=$(printf '%.0f' "$used_pct")
  ctx_remaining=$(printf '%.0f' "$remaining_pct")
  if [ "$ctx_used" -ge 80 ]; then
    ctx_color='\033[1;31m'  # Red when high usage
  elif [ "$ctx_used" -ge 50 ]; then
    ctx_color='\033[1;33m'  # Yellow at medium usage
  else
    ctx_color='\033[1;32m'  # Green when low usage
  fi
  parts+=("$(printf "${ctx_color}ctx: %s%% used / %s%% left\033[0m" "$ctx_used" "$ctx_remaining")")
elif [ -z "$used_pct" ]; then
  parts+=("$(printf '\033[0;90mctx: --\033[0m')")
fi

# Token counts (from last API call)
if [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
  parts+=("$(printf '\033[0;37min:%s out:%s\033[0m' "$input_tokens" "$output_tokens")")
fi

# Rate limits (Claude.ai subscription)
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
rate_parts=""
if [ -n "$five_pct" ]; then
  rate_parts="5h:$(printf '%.0f' "$five_pct")%"
fi
if [ -n "$week_pct" ]; then
  [ -n "$rate_parts" ] && rate_parts="$rate_parts "
  rate_parts="${rate_parts}7d:$(printf '%.0f' "$week_pct")%"
fi
if [ -n "$rate_parts" ]; then
  parts+=("$(printf '\033[0;35m%s\033[0m' "$rate_parts")")
fi

# Session name
if [ -n "$session_name" ]; then
  parts+=("$(printf '\033[0;90msession: %s\033[0m' "$session_name")")
fi

# Output style (if not default)
if [ -n "$output_style" ] && [ "$output_style" != "default" ]; then
  parts+=("$(printf '\033[0;90mstyle: %s\033[0m' "$output_style")")
fi

# Version
if [ -n "$version" ]; then
  parts+=("$(printf '\033[0;90mv%s\033[0m' "$version")")
fi

# Join with separator
printf '%s' "${parts[0]}"
for i in "${!parts[@]}"; do
  if [ "$i" -gt 0 ]; then
    printf ' | %s' "${parts[$i]}"
  fi
done
printf '\n'
