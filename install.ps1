# 이 저장소의 스킬을 Claude Code에 설치합니다 (윈도우 PowerShell).
#
#   .\install.ps1                  # 플러그인 방식 (권장, 스킬 + claude-code-setup)
#   .\install.ps1 -Copy            # 플러그인 대신 ~\.claude\skills 로 스킬 폴더 복사
#   .\install.ps1 -WithClaudeMem   # claude-mem 메모리 플러그인도 함께 설치
param([switch]$Copy, [switch]$WithClaudeMem)
$ErrorActionPreference = "Stop"

$Repo = "nick50511fxcs-ui/claude-skill-collection"
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
    claude plugin marketplace add $Repo
    if ($LASTEXITCODE -ne 0) { claude plugin marketplace update claude-skill-collection }
    claude plugin install skill-collection@claude-skill-collection
    claude plugin marketplace add anthropics/claude-plugins-official
    claude plugin install claude-code-setup@claude-plugins-official
}

if ($WithClaudeMem -and $HasClaude) {
    claude plugin marketplace add $Repo 2>$null
    claude plugin install claude-mem@claude-skill-collection
}

Write-Host "완료. Claude Code를 재시작하면 스킬이 적용됩니다."
