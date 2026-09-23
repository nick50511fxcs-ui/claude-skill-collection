#!/usr/bin/env bash
# Repository skill checks: count cap, SKILL.md format, and plugin validation when the claude CLI exists.
# Usage: bash scripts/check-skills.sh            # check
#        bash scripts/check-skills.sh --adding 1  # check the cap still holds after adding 1 skill
set -euo pipefail

MAX_SKILLS="${MAX_SKILLS:-50}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDING=0
[ "${1:-}" = "--adding" ] && ADDING="${2:-1}"

fail=0
count=0
desc_chars=0
for dir in "$ROOT"/skills/*/; do
  name="$(basename "$dir")"
  file="$dir/SKILL.md"
  if [ ! -f "$file" ]; then echo "✗ $name: missing SKILL.md"; fail=1; continue; fi
  count=$((count + 1))
  fm="$(awk 'NR==1 && /^---/ {f=1; next} f && /^---/ {exit} f' "$file")"
  fm_name="$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | tr -d '"' | head -1)"
  desc="$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -1)"
  [ "$fm_name" = "$name" ] || { echo "✗ $name: frontmatter name ('$fm_name') does not match the folder name"; fail=1; }
  [ -n "$desc" ] || { echo "✗ $name: missing description"; fail=1; }
  # User-invoked-only skills are not listed to the model, so they add no always-on tokens
  printf '%s\n' "$fm" | grep -q '^disable-model-invocation:[[:space:]]*true' || desc_chars=$((desc_chars + ${#desc}))
done

total=$((count + ADDING))
echo "Skills: $count / cap $MAX_SKILLS (adding $ADDING → $total)"
echo "Always-loaded descriptions: ~${desc_chars} characters"
if [ "$total" -gt "$MAX_SKILLS" ]; then
  echo "✗ Over the cap: remove $((total - MAX_SKILLS)) skill(s) before adding."
  fail=1
fi

# Repository convention: committed text is English. Vendored skills (with UPSTREAM.txt) keep their original text.
if command -v python3 >/dev/null 2>&1; then
  python3 - "$ROOT" <<'PY' || fail=1
import os, re, subprocess, sys
root = sys.argv[1]
hangul = re.compile("[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]")
vendored = {os.path.join("skills", d) for d in os.listdir(os.path.join(root, "skills"))
            if os.path.isfile(os.path.join(root, "skills", d, "UPSTREAM.txt"))}
files = subprocess.run(["git", "-C", root, "ls-files", "--cached", "--others", "--exclude-standard"],
                       capture_output=True, text=True).stdout.split("\n")
bad = []
for f in filter(None, files):
    # HANDOFF.md is a working note (/new) and may quote literal user-language examples.
    if f == "HANDOFF.md" or any(f == v or f.startswith(v + "/") for v in vendored):
        continue
    try:
        text = open(os.path.join(root, f), encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        continue
    bad += [f"{f}:{i}" for i, line in enumerate(text.splitlines(), 1) if hangul.search(line)]
for b in bad[:20]:
    print(f"✗ non-English text: {b}")
sys.exit(1 if bad else 0)
PY
fi

if command -v claude >/dev/null 2>&1; then
  claude plugin validate "$ROOT" >/dev/null || { echo "✗ claude plugin validate failed"; fail=1; }
fi

[ "$fail" = 0 ] && echo "✓ checks passed"
exit "$fail"
