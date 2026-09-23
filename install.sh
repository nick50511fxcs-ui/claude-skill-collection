#!/usr/bin/env bash
# 이 저장소의 스킬을 Claude Code에 설치합니다 (맥 / 리눅스 / 클라우드 환경).
#
#   bash install.sh                 # 플러그인 방식 (권장, 스킬 + claude-code-setup)
#   bash install.sh --copy          # 플러그인 대신 ~/.claude/skills 로 스킬 폴더 복사
#   bash install.sh --with-claude-mem   # claude-mem 메모리 플러그인도 함께 설치
#   bash install.sh --with-headroom     # 헤드룸(토큰 압축 MCP)도 함께 설치 (Python 3.10+ 필요)
#   bash install.sh --no-observer-autostart  # task-observer 세션 자동 활성화 설정을 건너뜀
set -euo pipefail

REPO="${CLAUDE_SKILLS_REPO:-nick50511fxcs-ui/claude-skill-collection}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="plugin"
WITH_MEM=0
WITH_HEADROOM=0
OBSERVER_AUTOSTART=1

for arg in "$@"; do
  case "$arg" in
    --copy) MODE="copy" ;;
    --with-claude-mem) WITH_MEM=1 ;;
    --with-headroom) WITH_HEADROOM=1 ;;
    --no-observer-autostart) OBSERVER_AUTOSTART=0 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

if [ "$MODE" = "plugin" ] && ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI가 없어 복사 방식으로 설치합니다."
  MODE="copy"
fi

if [ "$MODE" = "copy" ]; then
  mkdir -p "$HOME/.claude/skills"
  for dir in "$HERE"/skills/*/; do
    name="$(basename "$dir")"
    rm -rf "$HOME/.claude/skills/$name"
    cp -R "$dir" "$HOME/.claude/skills/$name"
    echo "✓ 스킬 복사: $name"
  done
else
  # add는 이미 등록돼 있어도 성공하므로, 다시 실행할 때 새 스킬을 받도록 항상 update도 합니다.
  claude plugin marketplace add "$REPO"
  claude plugin marketplace update claude-skill-collection
  claude plugin install skill-collection@claude-skill-collection
  claude plugin update skill-collection@claude-skill-collection
  claude plugin marketplace add anthropics/claude-plugins-official
  claude plugin install claude-code-setup@claude-plugins-official
fi

if [ "$WITH_MEM" = 1 ]; then
  if command -v claude >/dev/null 2>&1; then
    claude plugin marketplace add "$REPO"
    claude plugin install claude-mem@claude-skill-collection
  else
    echo "claude-mem은 claude CLI가 필요합니다. 건너뜁니다." >&2
  fi
fi

if [ "$WITH_HEADROOM" = 1 ]; then
  # 시스템 파이썬 패키지와 충돌하지 않도록 전용 가상환경에 설치합니다.
  VENV="$HOME/.headroom-venv"
  if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    echo "헤드룸은 Python 3.10 이상이 필요합니다. 건너뜁니다." >&2
  elif ! command -v claude >/dev/null 2>&1; then
    echo "헤드룸은 claude CLI가 필요합니다. 건너뜁니다." >&2
  else
    # 헤드룸은 선택 사항이라, 실패해도 나머지 설치(클라우드 세션 시작 포함)를 막지 않습니다.
    if { [ -x "$VENV/bin/headroom" ] || python3 -m venv "$VENV"; } \
      && "$VENV/bin/pip" install -q --upgrade "headroom-ai[mcp]" \
      && "$VENV/bin/headroom" mcp install; then
      echo "✓ 헤드룸 MCP 등록 완료"
    else
      echo "⚠ 헤드룸 설치에 실패했습니다. 나머지는 정상 설치되었습니다." >&2
    fi
  fi
fi

if [ "$OBSERVER_AUTOSTART" = 1 ]; then
  # 원작자 권장 방식: 전역 CLAUDE.md 활성화 블록 + SessionStart 훅.
  # 관찰 로그는 $HOME/.claude/skill-observations/ 에 쌓입니다.
  WORKSPACE="$HOME/.claude"
  CLAUDE_MD="$WORKSPACE/CLAUDE.md"
  HOOK="$WORKSPACE/hooks/task-observer-session-start.sh"
  mkdir -p "$WORKSPACE/hooks"
  cp "$HERE/activation/task-observer-session-start.sh" "$HOOK"
  chmod +x "$HOOK"

  # CLAUDE.md: 이전에 넣은 블록을 지우고 최신 블록으로 교체합니다.
  touch "$CLAUDE_MD"
  sed '/<!-- task-observer:start/,/<!-- task-observer:end -->/d' "$CLAUDE_MD" > "$CLAUDE_MD.tmp"
  if [ -s "$CLAUDE_MD.tmp" ]; then echo >> "$CLAUDE_MD.tmp"; fi
  sed "s#__WORKSPACE__#$WORKSPACE#g" "$HERE/activation/task-observer-claude-md.txt" >> "$CLAUDE_MD.tmp"
  mv "$CLAUDE_MD.tmp" "$CLAUDE_MD"

  # settings.json: SessionStart 훅을 (없을 때만) 추가합니다.
  SETTINGS="$WORKSPACE/settings.json" HOOK="$HOOK" python3 - <<'PY'
import json, os
path, hook = os.environ["SETTINGS"], os.environ["HOOK"]
try:
    with open(path) as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}
groups = data.setdefault("hooks", {}).setdefault("SessionStart", [])
if not any(h.get("command") == hook for g in groups for h in g.get("hooks", [])):
    groups.append({"hooks": [{"type": "command", "command": hook}]})
with open(path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
  echo "✓ task-observer 세션 자동 활성화 설정 (CLAUDE.md + SessionStart 훅)"
fi

echo "완료. Claude Code를 재시작하면 스킬이 적용됩니다."
