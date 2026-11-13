# 安装 obsidian-memory skill 到 DeepSeek Harness 用户技能库
# 用法：.\install.ps1
param(
    [string]$DshHome = "$env:USERPROFILE\.dsh"
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'obsidian-memory\SKILL.md'
$destDir = Join-Path $DshHome 'skills\obsidian-memory'
$dest = Join-Path $destDir 'SKILL.md'

if (-not (Test-Path $source)) {
    throw "找不到 $source，请在仓库根目录运行本脚本。"
}

New-Item -ItemType Directory -Force $destDir | Out-Null
Copy-Item $source $dest -Force

Write-Host ""
Write-Host "已安装到 $dest" -ForegroundColor Green
Write-Host ""
Write-Host "下一步（必做）：" -ForegroundColor Yellow
Write-Host "  1. 编辑上面的 SKILL.md 第 0 节，把 VAULT 换成你的 Obsidian 库路径。"
Write-Host "  2. 新开/恢复一个会话，让 agent 重新加载技能目录。"
Write-Host "  3. 想每轮自动生效：把 examples\AGENTS.example.md 的规则加到工作区 AGENTS.md。"
Write-Host ""
