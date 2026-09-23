#!/usr/bin/env bash
# 저장소 스킬 점검: 개수 상한, SKILL.md 형식, (claude CLI가 있으면) 플러그인 검증.
# 사용: bash scripts/check-skills.sh            # 점검
#       bash scripts/check-skills.sh --adding 1  # 1개 추가해도 상한 이내인지 미리 확인
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
  if [ ! -f "$file" ]; then echo "✗ $name: SKILL.md 없음"; fail=1; continue; fi
  count=$((count + 1))
  fm="$(awk 'NR==1 && /^---/ {f=1; next} f && /^---/ {exit} f' "$file")"
  fm_name="$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | tr -d '"' | head -1)"
  desc="$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -1)"
  [ "$fm_name" = "$name" ] || { echo "✗ $name: frontmatter name('$fm_name')이 폴더 이름과 다름"; fail=1; }
  [ -n "$desc" ] || { echo "✗ $name: description 없음"; fail=1; }
  # 직접 호출 전용 스킬은 목록에 올라가지 않으므로 상시 토큰 계산에서 제외
  printf '%s\n' "$fm" | grep -q '^disable-model-invocation:[[:space:]]*true' || desc_chars=$((desc_chars + ${#desc}))
done

total=$((count + ADDING))
echo "스킬 개수: $count / 상한 $MAX_SKILLS (추가 예정 $ADDING → $total)"
echo "상시 로드되는 description 합계: 약 ${desc_chars}자"
if [ "$total" -gt "$MAX_SKILLS" ]; then
  echo "✗ 상한 초과: 추가하기 전에 $((total - MAX_SKILLS))개를 정리해야 합니다."
  fail=1
fi

if command -v claude >/dev/null 2>&1; then
  claude plugin validate "$ROOT" >/dev/null || { echo "✗ claude plugin validate 실패"; fail=1; }
fi

[ "$fail" = 0 ] && echo "✓ 점검 통과"
exit "$fail"
