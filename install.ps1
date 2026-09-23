# Installs this repository's skills into Claude Code (Windows PowerShell).
#
#   .\install.ps1                  # plugin mode (recommended: skills + claude-code-setup)
#   .\install.ps1 -Copy            # copy skill folders to ~\.claude\skills instead of a plugin
#   .\install.ps1 -WithClaudeMem   # also install the claude-mem memory plugin
#   .\install.ps1 -WithHeadroom    # also install Headroom (context-compression MCP, needs Python 3.10+)
param([switch]$Copy, [switch]$WithClaudeMem, [switch]$WithHeadroom)
$ErrorActionPreference = "Stop"

$Repo = if ($env:CLAUDE_SKILLS_REPO) { $env:CLAUDE_SKILLS_REPO } else { "nick50511fxcs-ui/claude-skill-collection" }
$HasClaude = [bool](Get-Command claude -ErrorAction SilentlyContinue)

if (-not $Copy -and -not $HasClaude) {
    Write-Host "claude CLI not found; falling back to copy mode."
    $Copy = $true
}

if ($Copy) {
    $Dest = Join-Path $HOME ".claude\skills"
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Get-ChildItem -Directory (Join-Path $PSScriptRoot "skills") | ForEach-Object {
        $Target = Join-Path $Dest $_.Name
        if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
        Copy-Item -Recurse $_.FullName $Target
        Write-Host "[ok] copied skill: $($_.Name)"
    }
} else {
    # 'add' succeeds even when already registered, so always 'update' too so re-runs pick up new skills.
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
    # Install into a dedicated venv so it cannot conflict with system Python packages.
    $Venv = Join-Path $HOME ".headroom-venv"
    $Headroom = Join-Path $Venv "Scripts\headroom.exe"
    if (-not $HasClaude) {
        Write-Host "Headroom needs the claude CLI; skipping."
    } else {
        # Headroom is optional: a failure here must not break the rest of the install.
        if (-not (Test-Path $Headroom)) { python -m venv $Venv }
        if ($LASTEXITCODE -eq 0) { & (Join-Path $Venv "Scripts\pip.exe") install -q --upgrade "headroom-ai[mcp]" }
        if ($LASTEXITCODE -eq 0) { & $Headroom mcp install }
        if ($LASTEXITCODE -eq 0) { Write-Host "[ok] Headroom MCP registered" }
        else { Write-Host "[warn] Headroom install failed; everything else was installed." }
    }
}

Write-Host "Done. Restart Claude Code to load the skills."
