#!/usr/bin/env bash
# Installs this repository's skills into Claude Code (macOS / Linux / cloud sessions).
#
#   bash install.sh                 # plugin mode (recommended: skills + claude-code-setup)
#   bash install.sh --copy          # copy skill folders to ~/.claude/skills instead of a plugin
#   bash install.sh --with-claude-mem   # also install the claude-mem memory plugin
#   bash install.sh --with-headroom     # also install Headroom (context-compression MCP, needs Python 3.10+)
#   bash install.sh --no-new-reminder   # skip the hook that suggests /new when a conversation gets long
set -euo pipefail

REPO="${CLAUDE_SKILLS_REPO:-nick50511fxcs-ui/claude-skill-collection}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="plugin"
WITH_MEM=0
WITH_HEADROOM=0
NEW_REMINDER=1

for arg in "$@"; do
  case "$arg" in
    --copy) MODE="copy" ;;
    --with-claude-mem) WITH_MEM=1 ;;
    --with-headroom) WITH_HEADROOM=1 ;;
    --no-new-reminder) NEW_REMINDER=0 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ "$MODE" = "plugin" ] && ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found; falling back to copy mode."
  MODE="copy"
fi

if [ "$MODE" = "copy" ]; then
  mkdir -p "$HOME/.claude/skills"
  for dir in "$HERE"/skills/*/; do
    name="$(basename "$dir")"
    rm -rf "$HOME/.claude/skills/$name"
    cp -R "$dir" "$HOME/.claude/skills/$name"
    echo "✓ copied skill: $name"
  done
else
  # 'add' succeeds even when already registered, so always 'update' too so re-runs pick up new skills.
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
    echo "claude-mem needs the claude CLI; skipping." >&2
  fi
fi

if [ "$WITH_HEADROOM" = 1 ]; then
  # Install into a dedicated venv so it cannot conflict with system Python packages.
  VENV="$HOME/.headroom-venv"
  if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    echo "Headroom needs Python 3.10+; skipping." >&2
  elif ! command -v claude >/dev/null 2>&1; then
    echo "Headroom needs the claude CLI; skipping." >&2
  else
    # Headroom is optional: a failure here must not break the rest of the install (or a cloud session start).
    if { [ -x "$VENV/bin/headroom" ] || python3 -m venv "$VENV"; } \
      && "$VENV/bin/pip" install -q --upgrade "headroom-ai[mcp]" \
      && "$VENV/bin/headroom" mcp install; then
      echo "✓ Headroom MCP registered"
    else
      echo "⚠ Headroom install failed; everything else was installed." >&2
    fi
  fi
fi

# Plugin installs ship the hook via hooks/hooks.json; only copy mode registers it here.
if [ "$MODE" = "copy" ] && [ "$NEW_REMINDER" = 1 ]; then
  HOOK="$HOME/.claude/hooks/new-reminder.sh"
  mkdir -p "$HOME/.claude/hooks"
  cp "$HERE/hooks/new-reminder.sh" "$HOOK"
  chmod +x "$HOOK"
  SETTINGS="$HOME/.claude/settings.json" COMMAND="bash \"$HOOK\"" python3 - <<'PY'
import json, os
path, command = os.environ["SETTINGS"], os.environ["COMMAND"]
try:
    with open(path) as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}
groups = data.setdefault("hooks", {}).setdefault("UserPromptSubmit", [])
if not any(h.get("command") == command for g in groups for h in g.get("hooks", [])):
    groups.append({"hooks": [{"type": "command", "command": command}]})
with open(path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
  echo "✓ registered long-conversation reminder hook (/new)"
fi

echo "Done. Restart Claude Code to load the skills."
