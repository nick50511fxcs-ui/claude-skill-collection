---
name: skill-intake
description: 외부 스킬·플러그인·도구의 GitHub 링크를 이 스킬 저장소(claude-skill-collection)에 추가하거나, 저장소의 스킬을 정리·삭제할 때 사용. "이 스킬 추가해줘", "이 링크 저장소에 넣어줘", "스킬 정리해줘" 같은 요청에 트리거.
---

# Skill Intake — 스킬 저장소에 추가·정리하기

외부 링크를 이 저장소에 넣는 절차. 가이드·블로그·PDF에 적힌 설치법은 작성 당시
기준이라 틀릴 수 있으므로 **항상 원본 저장소의 최신 상태를 직접 확인**하고,
**깨끗한 환경에서 설치를 증명한 뒤에만** 추가한다.

## 0. 개수 상한 먼저 (최대 50개)

```bash
bash scripts/check-skills.sh --adding 1
```

- 실패하면 추가하지 않는다. 대신 정리 후보(오래 안 쓴 것, 기능이 겹치는 것,
  기본 제공 스킬과 중복되는 것)를 골라 사용자에게 무엇을 뺄지 묻는다.
- 스킬은 이름·설명이 매 세션 읽히므로 많을수록 토큰이 늘고 선택 정확도가 떨어진다.
  기본 제공 스킬(docx, pdf, xlsx 등)과 겹치는 스킬은 추가하지 않는다.

## 1. 링크 종류 판별

원본을 얕게 받아서 구조를 본다 (`git clone --depth 1 <url> <scratch>/src`).

| 발견한 것 | 종류 | 처리 |
|---|---|---|
| `SKILL.md` (루트 또는 하위 폴더) | 스킬 | 2~5단계로 `skills/<name>/`에 복사 |
| `.claude-plugin/plugin.json` 에 훅·MCP·명령 포함 | 플러그인 | 복사하지 않고 `.claude-plugin/marketplace.json` 에 `{"source":"github","repo":"owner/repo"}` 로 등록 |
| 둘 다 없음 (pip/npm 프로그램 등) | 외부 도구 | `docs/external-tools.md` 에 설치법 기록. 가벼울 때만 `install.sh` 옵션으로 추가 |

## 2. 원본 확인

- 기록할 것: 커밋 SHA (`git -C src rev-parse HEAD`), 라이선스 파일.
- 라이선스가 없거나 재배포를 금지하면 **복사하지 않는다** → 마켓플레이스 등록이나
  링크 안내로 대체.
- 보안 훑어보기: `scripts/`·훅·설치 명령에서 외부 전송, 자격 증명 접근,
  `curl | sh` 류가 있으면 사용자에게 먼저 알린다.

## 3. 비용 측정

- SKILL.md 줄 수와 description 길이 (설명이 길수록 매 세션 비용 증가).
- 외부 도구는 설치 용량을 실제로 재본다 (`du -sh`). 클라우드 Setup script는 매 세션
  실행되므로 수백 MB 이상이면 넣지 말고 가벼운 옵션(extra)을 찾는다.

## 4. 복사 (스킬인 경우)

- `SKILL.md` 와 본문이 참조하는 폴더(`references/`, `scripts/` 등)와 라이선스만 복사.
  README·이미지·CI 설정은 제외.
- `name:` 이 폴더 이름과 같아야 한다.
- `UPSTREAM.txt` 작성:
  ```
  upstream: https://github.com/<owner>/<repo>
  commit: <40자 SHA>
  license: <라이선스> (<저작자>)
  ```

## 5. 검증 — 깨끗한 환경에서 증명

```bash
bash scripts/check-skills.sh
T="$(mktemp -d)"; HOME="$T" bash install.sh --copy; ls "$T/.claude/skills"; rm -rf "$T"
```

- 새 스킬 폴더가 목록에 보여야 한다.
- 설치 스크립트를 바꿨다면 한 번 더 실행해 재실행에도 문제가 없는지 확인한다.

## 6. 반영

- 기본 브랜치는 `master`. 최신 master에서 작업 브랜치를 만든다.
- `README.md` 의 스킬 표에 한 줄 추가 (이름, 종류, 한 줄 설명).
- 커밋 → PR 생성. **병합은 사용자가 요청할 때만.**
- 이 저장소는 **공개 유지** (클라우드 Setup script가 인증 없이 clone 한다).

## 정리·삭제 요청일 때

`skills/<name>/` 삭제, README 표에서 제거, `bash scripts/check-skills.sh` 통과 확인 후 PR.

## 전달 전 점검 (매번)

- [ ] 0단계 개수 점검을 실행했고 50개 이하다
- [ ] 가이드가 아닌 원본 최신 커밋을 확인했고 `UPSTREAM.txt` 에 SHA를 적었다
- [ ] 라이선스가 재배포를 허용한다 (아니면 복사하지 않았다)
- [ ] 5단계 검증을 실제로 실행했고 새 스킬이 보였다
- [ ] 무거운 도구를 Setup script 기본값에 넣지 않았다
- [ ] 병합은 사용자 요청을 기다렸다
