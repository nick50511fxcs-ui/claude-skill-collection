# 스킬이 아닌 외부 도구 (자동 설치하지 않음)

PDF에 소개된 5개 중 아래 2개는 스킬/플러그인이 아니라 **내 컴퓨터에 설치해서 돌리는 프로그램**이라
이 저장소에 담아 동기화할 수 없습니다. 헤드룸은 `install.sh --with-headroom` 으로 설치할 수 있고,
옴니라우트는 필요한 PC에서 직접 설치하세요.

## 헤드룸 (Headroom) — 토큰 압축 MCP

- 원본: https://github.com/headroomlabs-ai/headroom
- 필요: Python 3.10+

```bash
pip install "headroom-ai[all]"
headroom mcp install && claude
# VS Code 확장 사용 시: headroom wrap vscode-claude   (되돌리기: headroom unwrap vscode-claude)
```

`install.sh --with-headroom` 은 `~/.headroom-venv` 전용 가상환경에 `headroom-ai[mcp]` 를 설치한 뒤
`headroom mcp install` 까지 실행합니다.

PDF의 `headroom-ai[all]` 은 GPU용 머신러닝 라이브러리(torch 등)까지 받아서 **약 7GB** 입니다.
MCP 도구(compress·retrieve·stats)만 쓰려면 `[mcp]` (약 430MB)로 충분해서 스크립트는 이쪽을 씁니다.
이미지·문서 압축 등 추가 기능이 필요하면 로컬 PC에서만 `[all]` 로 설치하세요.

참고: `headroom mcp install` 은 압축/조회 **도구(compress·retrieve·stats)만** 등록합니다.
모든 요청을 자동으로 압축하려면 프록시를 따로 켜고 Claude Code를 거기에 연결해야 합니다
(로컬 PC 전용, 클라우드 세션에서는 해당 없음):
```bash
headroom proxy                                           # 이 창은 켜둔 채로
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 claude          # 새 터미널에서
```

## 옴니라우트 (OmniRoute) — 무료 모델 라우팅 게이트웨이

- 원본: https://github.com/diegosouzapw/OmniRoute

```bash
npm install -g omniroute
omniroute                                   # 이 창은 켜둔 채로
# 새 터미널에서
export ANTHROPIC_BASE_URL=http://localhost:20128/v1   # 윈도우: $env:ANTHROPIC_BASE_URL="http://localhost:20128/v1"
claude
```

⚠️ 주의
- 이걸 켜면 요청(프롬프트·코드)이 Claude가 아닌 **제3자 무료 모델 제공자들**로 전송됩니다.
  회사 코드나 민감한 자료가 있는 프로젝트에서는 쓰지 마세요.
- 답변 품질·도구 호출 호환성은 모델마다 다릅니다.
- claude.ai/code 클라우드 세션에서는 로컬 게이트웨이를 쓸 수 없습니다.
- 원래대로 돌아가려면 `ANTHROPIC_BASE_URL` 없이 새 터미널에서 `claude` 를 실행하면 됩니다.
