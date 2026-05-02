param(
  [ValidateSet("infra:up", "infra:down", "up", "down", "reset", "config", "ps", "logs", "migrate")]
  [string]$Action = "config",
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "instance-env.ps1")

$repoRoot = Get-RepoRoot -ScriptDirectory $scriptDir
$runtime = Resolve-YunwuRuntimeEnv -RepoRoot $repoRoot
$app = $Action -in @("up", "down", "reset", "config", "ps", "logs", "migrate")
$composeArgs = Get-YunwuComposeArgs -RepoRoot $repoRoot -EnvPath $runtime.EnvPath -App:$app

Push-Location $repoRoot
try {
  Write-Host "Instance: $($runtime.InstanceId) ($($runtime.ComposeProjectName))" -ForegroundColor Cyan
  Write-Host "Env: $($runtime.EnvPath)" -ForegroundColor DarkGray

  switch ($Action) {
    "infra:up" {
      & docker @composeArgs up -d
    }
    "infra:down" {
      & docker @composeArgs down
    }
    "up" {
      $dockerArgs = @($composeArgs + @("up", "-d"))
      if ($Build) {
        $dockerArgs += "--build"
      }
      & docker @dockerArgs
    }
    "down" {
      & docker @composeArgs down
    }
    "reset" {
      & docker @composeArgs down -v
    }
    "config" {
      & docker @composeArgs config
    }
    "ps" {
      & docker @composeArgs ps
    }
    "logs" {
      & docker @composeArgs logs --tail=200
    }
    "migrate" {
      & docker @composeArgs run --rm api ./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
    }
  }
}
finally {
  Pop-Location
}
