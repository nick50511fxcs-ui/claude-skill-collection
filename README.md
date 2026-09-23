# 클로드 스킬모음

다운받은 Claude 스킬(SKILL.md)들을 모아두는 저장소입니다.
이 저장소 자체가 **Claude Code 플러그인 마켓플레이스**라서, 어느 컴퓨터·어느 클라우드 세션에서든
한 줄로 같은 스킬을 불러올 수 있습니다.

## 들어있는 것

| 이름 | 종류 | 설명 | 설치 방식 |
|---|---|---|---|
| `task-observer` | 스킬 (`skills/`) | 반복 작업을 기록하고 스킬로 만들라고 제안하는 관찰자 ([원본](https://github.com/rebelytics/one-skill-to-rule-them-all), CC BY 4.0) | `skill-collection` 플러그인에 포함 |
| `skill-intake` | 스킬 (`skills/`) | GitHub 링크를 이 저장소에 추가·정리하는 절차 (원본 확인 → 비용 측정 → 빈 환경 설치 검증 → PR) | `skill-collection` 플러그인에 포함 |
| `task` | 단축 명령 (`skills/`) | `/task` 로 task-observer 켜기. `/task 할 일` 처럼 요청을 바로 이어 써도 됨. 직접 입력할 때만 동작해서 평소 토큰 소모 없음 | `skill-collection` 플러그인에 포함 (플러그인 설치 시 이름은 `/skill-collection:task`) |
| `claude-code-setup` | 공식 플러그인 | 프로젝트를 스캔해 훅·스킬·MCP 등을 추천 (앤트로픽 공식) | 기본 설치 |
| `claude-mem` | 외부 플러그인 | 세션이 바뀌어도 기억하는 메모리 ([thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)) | 선택 설치 (`--with-claude-mem`) |
| 헤드룸 | 외부 도구 (MCP) | 토큰 압축 ([headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom)) | 선택 설치 (`--with-headroom`) |
| 옴니라우트 | 외부 도구 | 무료 모델 라우팅 | 자동 설치 안 함 → [docs/external-tools.md](docs/external-tools.md) |

## 구조

```
.claude-plugin/marketplace.json   이 저장소를 마켓플레이스로 등록
.claude-plugin/plugin.json        skills/ 전체를 "skill-collection" 플러그인으로 묶음
.claude/skills -> ../skills       이 저장소를 연 세션에서 스킬 자동 로드 (심볼릭 링크)
.claude/settings.json             claude-code-setup 플러그인 설치 제안
skills/<스킬이름>/SKILL.md         스킬 본체 (새 스킬은 여기에 폴더째 추가)
install.sh / install.ps1          원클릭 설치 스크립트
```

## 사용법

### 1. Claude Code 안에서 (가장 간단, 모든 PC 공통)

```
/plugin marketplace add nick50511fxcs-ui/claude-skill-collection
/plugin install skill-collection@claude-skill-collection
```

### 2. 터미널에서 스크립트로 (새 PC)

맥 / 리눅스:
```bash
git clone https://github.com/nick50511fxcs-ui/claude-skill-collection.git
cd claude-skill-collection && bash install.sh              # --with-claude-mem --with-headroom 추가 가능
```

윈도우 PowerShell:
```powershell
git clone https://github.com/nick50511fxcs-ui/claude-skill-collection.git
cd claude-skill-collection; .\install.ps1                   # -WithClaudeMem -WithHeadroom 추가 가능
```

`claude` 명령이 없거나 플러그인 대신 파일로 넣고 싶으면 `--copy` / `-Copy` 옵션을 쓰면
`~/.claude/skills/` 로 스킬 폴더가 복사됩니다.

### 3. 클라우드 (claude.ai/code 웹·모바일)

- **이 저장소로 세션을 열 때**: `.claude/skills` 링크 덕분에 `skills/` 의 스킬이 설치 없이 바로 보입니다.
- **다른 저장소에서도 쓰려면**: claude.ai/code의 환경(Environment) 설정 → **Setup script**에 아래를 넣으세요.
  이후 그 환경에서 여는 모든 세션에 스킬과 헤드룸이 설치됩니다.
  ```bash
  git clone --depth 1 https://github.com/nick50511fxcs-ui/claude-skill-collection.git /tmp/skills \
    && bash /tmp/skills/install.sh --copy --with-headroom || true
  ```
  - 끝의 `|| true` 는 설치가 실패해도 세션 시작을 막지 않게 합니다.
  - Setup script 단계에는 GitHub 로그인 정보가 없으므로 이 저장소는 **공개(public)** 로 유지해야 합니다.
    비공개로 바꾸면 `could not read Username` (exit 128) 오류가 납니다.

### 4. claude.ai 채팅 앱 (웹/데스크톱)

설정 → Capabilities → Skills 에서 스킬 폴더를 ZIP으로 올립니다.
```bash
cd skills && zip -r task-observer.zip task-observer
```

## 스킬 개수 상한: 50개

스킬은 이름·설명이 매 세션 읽혀서 많을수록 토큰이 늘고 선택 정확도가 떨어집니다.
`scripts/check-skills.sh` 가 50개를 넘으면 실패하고, GitHub Actions(`check-skills`)가 모든 PR에서 이를 검사합니다.
상한은 환경 변수 `MAX_SKILLS` 로 바꿀 수 있습니다.

## 새 스킬 추가하기

Claude에게 링크와 함께 "이 스킬 저장소에 추가해줘"라고 하면 `skill-intake` 스킬이 아래 절차를 따릅니다.

1. `skills/<스킬이름>/SKILL.md` (필요하면 `references/`, `scripts/` 등)를 넣습니다.
2. `bash scripts/check-skills.sh` 로 확인 후 커밋·푸시합니다.
3. 다른 PC에서는 `bash install.sh` 를 다시 실행하거나, Claude Code 안에서 아래 두 줄을 입력한 뒤 재시작하면 반영됩니다.
   ```
   /plugin marketplace update claude-skill-collection
   /plugin update skill-collection@claude-skill-collection
   ```
   `plugin.json` 에 `version` 을 적지 마세요. 적어두면 버전을 올리기 전까지 새 스킬이 설치된 쪽에 반영되지 않습니다.

외부 저장소에서 받은 스킬은 폴더 안에 `UPSTREAM.txt`(원본 주소·커밋·라이선스)를 남겨두면 나중에 업데이트하기 쉽습니다.
