#!/usr/bin/env bash
# 이 저장소의 스킬을 Claude Code에 설치합니다 (맥 / 리눅스 / 클라우드 환경).
#
#   bash install.sh                 # 플러그인 방식 (권장, 스킬 + claude-code-setup)
#   bash install.sh --copy          # 플러그인 대신 ~/.claude/skills 로 스킬 폴더 복사
#   bash install.sh --with-claude-mem   # claude-mem 메모리 플러그인도 함께 설치
set -euo pipefail

REPO="nick50511fxcs-ui/claude-skill-collection"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="plugin"
WITH_MEM=0

for arg in "$@"; do
  case "$arg" in
    --copy) MODE="copy" ;;
    --with-claude-mem) WITH_MEM=1 ;;
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
  claude plugin marketplace add "$REPO" || claude plugin marketplace update claude-skill-collection
  claude plugin install skill-collection@claude-skill-collection
  claude plugin marketplace add anthropics/claude-plugins-official || true
  claude plugin install claude-code-setup@claude-plugins-official
fi

if [ "$WITH_MEM" = 1 ]; then
  if command -v claude >/dev/null 2>&1; then
    claude plugin marketplace add "$REPO" 2>/dev/null || true
    claude plugin install claude-mem@claude-skill-collection
  else
    echo "claude-mem은 claude CLI가 필요합니다. 건너뜁니다." >&2
  fi
fi

echo "완료. Claude Code를 재시작하면 스킬이 적용됩니다."
