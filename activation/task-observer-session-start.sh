#!/bin/sh
# SessionStart 훅: 세션마다 task-observer 활성화 지시와 관찰 로그 상태를 주입합니다.
# 원본: skills/task-observer/references/environments.md "A session-start hook"
d="${OBS_WORKSPACE:-$HOME/.claude}/skill-observations"
open=$(find "$d/observation-log" -maxdepth 1 -name '*.md' -exec grep -l '^status: open$' {} + 2>/dev/null | wc -l | tr -d ' ')
last=$(cat "$d/last-review-date.txt" 2>/dev/null || echo never)
msg="Invoke the task-observer skill before the first tool call and run its Session Start Protocol."
if [ "$open" -gt 0 ]; then
  msg="$msg $open open observations; last review: $last."
  case "$last" in (never) msg="$msg Offer the review." ;; esac
fi
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
