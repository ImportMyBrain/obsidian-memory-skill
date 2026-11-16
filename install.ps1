# Install the obsidian-memory skill into DeepSeek Harness.
# Usage:
#   .\install.ps1 -Vault "D:\Obsidian\MyVault"
#   .\install.ps1                # then edit SKILL.md section 0 manually
param(
    [string]$DshHome = "$env:USERPROFILE\.dsh",
    [string]$Vault,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'obsidian-memory'
$dest = Join-Path $DshHome 'skills\obsidian-memory'

if (-not (Test-Path (Join-Path $source 'SKILL.md'))) {
    throw "Cannot find $source\SKILL.md - run this script from the repository root."
}

if (Test-Path $dest) {
    if (-not $Force) {
        $backup = "$dest.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Move-Item -LiteralPath $dest -Destination $backup
        Write-Host "backup: $backup" -ForegroundColor DarkGray
    } else {
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
}

New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force

if ($Vault) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $skillFile = Join-Path $dest 'SKILL.md'
    $text = [IO.File]::ReadAllText($skillFile, $utf8)
    if ($text.Contains('__VAULT_PATH__')) {
        $text = $text.Replace('__VAULT_PATH__', $Vault)
        [IO.File]::WriteAllText($skillFile, $text, $utf8)
    }
}

Write-Host ""
Write-Host "Installed to $dest" -ForegroundColor Green
if (-not $Vault) {
    Write-Host "Note: -Vault was not provided, so VAULT in SKILL.md is still __VAULT_PATH__." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit SKILL.md section 0 (VAULT / MEMORY_DIR / ARCHIVE_DIRS) if needed."
Write-Host "  2. Restart / reopen the DSH session so the skill catalog refreshes."
Write-Host "  3. Build the digest + index once (and after major vault changes):"
if ($Vault) {
    Write-Host "     node `"$dest\scripts\memory-build.mjs`" --vault `"$Vault`" --archive `"Chats`""
} else {
    Write-Host "     node `"$dest\scripts\memory-build.mjs`" --vault `"<your-vault>`" --archive `"Chats`""
}
Write-Host "  4. For always-on behavior, add the rule from examples\AGENTS.example.md to AGENTS.md."
Write-Host ""
