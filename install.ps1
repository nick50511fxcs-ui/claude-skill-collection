# 이 저장소의 스킬을 Claude Code에 설치합니다 (윈도우 PowerShell).
#
#   .\install.ps1                  # 플러그인 방식 (권장, 스킬 + claude-code-setup)
#   .\install.ps1 -Copy            # 플러그인 대신 ~\.claude\skills 로 스킬 폴더 복사
#   .\install.ps1 -WithClaudeMem   # claude-mem 메모리 플러그인도 함께 설치
#   .\install.ps1 -WithHeadroom    # 헤드룸(토큰 압축 MCP)도 함께 설치 (Python 3.10+ 필요)
param([switch]$Copy, [switch]$WithClaudeMem, [switch]$WithHeadroom)
$ErrorActionPreference = "Stop"

$Repo = if ($env:CLAUDE_SKILLS_REPO) { $env:CLAUDE_SKILLS_REPO } else { "nick50511fxcs-ui/claude-skill-collection" }
$HasClaude = [bool](Get-Command claude -ErrorAction SilentlyContinue)

if (-not $Copy -and -not $HasClaude) {
    Write-Host "claude CLI가 없어 복사 방식으로 설치합니다."
    $Copy = $true
}

if ($Copy) {
    $Dest = Join-Path $HOME ".claude\skills"
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Get-ChildItem -Directory (Join-Path $PSScriptRoot "skills") | ForEach-Object {
        $Target = Join-Path $Dest $_.Name
        if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
        Copy-Item -Recurse $_.FullName $Target
        Write-Host "✓ 스킬 복사: $($_.Name)"
    }
} else {
    # add는 이미 등록돼 있어도 성공하므로, 다시 실행할 때 새 스킬을 받도록 항상 update도 합니다.
    claude plugin marketplace add $Repo
    claude plugin marketplace update claude-skill-collection
    claude plugin install skill-collection@claude-skill-collection
    claude plugin update skill-collection@claude-skill-collection
    claude plugin marketplace add anthropics/claude-plugins-official
    claude plugin install claude-code-setup@claude-plugins-official
}

if ($WithClaudeMem -and $HasClaude) {
    claude plugin marketplace add $Repo
    claude plugin install claude-mem@claude-skill-collection
}

if ($WithHeadroom) {
    # 시스템 파이썬 패키지와 충돌하지 않도록 전용 가상환경에 설치합니다.
    $Venv = Join-Path $HOME ".headroom-venv"
    $Headroom = Join-Path $Venv "Scripts\headroom.exe"
    if (-not $HasClaude) {
        Write-Host "헤드룸은 claude CLI가 필요합니다. 건너뜁니다."
    } else {
        # 헤드룸은 선택 사항이라, 실패해도 나머지 설치를 막지 않습니다.
        if (-not (Test-Path $Headroom)) { python -m venv $Venv }
        if ($LASTEXITCODE -eq 0) { & (Join-Path $Venv "Scripts\pip.exe") install -q --upgrade "headroom-ai[mcp]" }
        if ($LASTEXITCODE -eq 0) { & $Headroom mcp install }
        if ($LASTEXITCODE -eq 0) { Write-Host "✓ 헤드룸 MCP 등록 완료" }
        else { Write-Host "⚠ 헤드룸 설치에 실패했습니다. 나머지는 정상 설치되었습니다." }
    }
}

Write-Host "완료. Claude Code를 재시작하면 스킬이 적용됩니다."
