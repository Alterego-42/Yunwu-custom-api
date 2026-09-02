# 轻量本地开发准备：生成 .env 并安装依赖（无需 Docker）
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Green
} else {
  Write-Host ".env already exists; leaving it unchanged." -ForegroundColor DarkGray
}

if (-not $SkipInstall) {
  pnpm install
}

pnpm --filter @yunwu/shared build

Write-Host ""
Write-Host "Ready. Start the dev servers with:" -ForegroundColor Green
Write-Host "  pnpm --filter @yunwu/api dev    # API + SQLite + 内置任务队列 (http://127.0.0.1:3000)"
Write-Host "  pnpm --filter @yunwu/web dev    # Web (http://127.0.0.1:5173)"
