#!/usr/bin/env bash
# UserPromptSubmit 훅: 현재 대화 크기(토큰)가 기준을 넘으면 /new 저장을 제안하라고 Claude에게 알립니다.
# 기준: NEW_REMINDER_TOKENS (기본 100000). 이후 같은 간격만큼 늘 때마다 한 번씩 다시 알림.
# 어떤 오류가 나도 조용히 종료해 대화를 막지 않습니다.
input="$(cat)"
NEW_REMINDER_TOKENS="${NEW_REMINDER_TOKENS:-100000}" python3 - "$input" <<'PY' 2>/dev/null || true
import json, os, sys, collections

step = int(os.environ["NEW_REMINDER_TOKENS"])
data = json.loads(sys.argv[1])
path, sid = data.get("transcript_path"), data.get("session_id", "unknown")
if not path or not os.path.exists(path):
    sys.exit(0)

# 마지막 응답의 입력 토큰 = 지금 매번 다시 읽는 대화 크기
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
    "save a handoff note and continue in a new session, e.g. '대화가 길어져 토큰 사용량이 늘고 있어요. "
    "`/new` 를 입력하시면 지금까지 내용을 저장소에 요약 저장하고 새 세션에서 이어갈 수 있어요.' "
    "Ask once; do not repeat it in later replies."
)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": msg}}, ensure_ascii=False))
PY
exit 0
