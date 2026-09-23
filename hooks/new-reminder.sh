#!/usr/bin/env bash
# UserPromptSubmit hook: when the conversation size (tokens) passes a threshold, tell Claude to suggest /new.
# Threshold: NEW_REMINDER_TOKENS (default 100000); reminds again once per further step of the same size.
# Any error exits silently so the conversation is never blocked.
input="$(cat)"
NEW_REMINDER_TOKENS="${NEW_REMINDER_TOKENS:-100000}" python3 - "$input" <<'PY' 2>/dev/null || true
import json, os, sys, collections

step = int(os.environ["NEW_REMINDER_TOKENS"])
data = json.loads(sys.argv[1])
path, sid = data.get("transcript_path"), data.get("session_id", "unknown")
if not path or not os.path.exists(path):
    sys.exit(0)

# Input tokens of the latest reply = the conversation size re-read on every reply
used = 0
with open(path, encoding="utf-8", errors="ignore") as f:
    for line in collections.deque(f, maxlen=300):
        try:
            msg = json.loads(line).get("message")
        except ValueError:
            continue
        if isinstance(msg, dict) and isinstance(msg.get("usage"), dict):
            u = msg["usage"]
            used = sum(u.get(k) or 0 for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))

level = used // step
if level < 1:
    sys.exit(0)
state_dir = os.path.join(os.path.expanduser("~"), ".claude", "new-reminder")
os.makedirs(state_dir, exist_ok=True)
state = os.path.join(state_dir, sid)
try:
    last = int(open(state).read().strip() or 0)
except (OSError, ValueError):
    last = 0
if level <= last:
    sys.exit(0)
open(state, "w").write(str(level))

msg = (
    f"This conversation is now about {used // 1000}k tokens and every reply re-reads all of it. "
    "After answering the user's message, add one short line in the user's language asking whether to "
    "save a handoff note and continue in a new session, e.g. 'This conversation is getting long and uses more tokens per reply. "
    "Type `/new` to save a short summary to the repo and continue in a new session.' "
    "Ask once; do not repeat it in later replies."
)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": msg}}, ensure_ascii=False))
PY
exit 0
