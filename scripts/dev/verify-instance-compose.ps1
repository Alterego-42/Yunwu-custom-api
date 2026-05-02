param(
  [switch]$App
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "instance-env.ps1")

$repoRoot = Get-RepoRoot -ScriptDirectory $scriptDir
$runtime = Resolve-YunwuRuntimeEnv -RepoRoot $repoRoot
$composeArgs = Get-YunwuComposeArgs -RepoRoot $repoRoot -EnvPath $runtime.EnvPath -App:$App

function Assert-Text([bool]$Condition, [string]$Message) {
  if (-not $Condition) {
    throw $Message
  }
}

$portValues = @(
  $runtime.Ports.Api,
  $runtime.Ports.Web,
  $runtime.Ports.Postgres,
  $runtime.Ports.Redis,
  $runtime.Ports.Minio,
  $runtime.Ports.MinioConsole
)
Assert-Text ($runtime.Values['YUNWU_INSTANCE_ID'] -eq $runtime.InstanceId) "runtime env instance id mismatch"
Assert-Text ($runtime.Values['COMPOSE_PROJECT_NAME'] -eq $runtime.ComposeProjectName) "runtime env compose project mismatch"
Assert-Text ($runtime.Values['AUTH_COOKIE_NAME'] -eq ('yunwu_session_' + $runtime.InstanceId)) "runtime env cookie name is not instance scoped"
Assert-Text ($runtime.Values['AUTH_SESSION_SECRET'] -and $runtime.Values['AUTH_SESSION_SECRET'] -ne 'yunwu-dev-session-secret-change-me') "runtime env session secret is missing or default"
Assert-Text (($portValues | Select-Object -Unique).Count -eq $portValues.Count) "runtime env contains duplicate host ports"

Push-Location $repoRoot
try {
  $config = (& docker @composeArgs config) -join "`n"
  Assert-Text ($config -match "name:\s+$($runtime.ComposeProjectName)") "compose project name mismatch"
  Assert-Text ($config -notmatch "container_name:") "compose config still contains container_name"
  Assert-Text ($config -match "name:\s+$($runtime.ComposeProjectName)_default") "default network is not project scoped"
  Assert-Text ($config -match "name:\s+$($runtime.ComposeProjectName)_postgres_data") "postgres volume is not project scoped"
  Assert-Text ($config -match "name:\s+$($runtime.ComposeProjectName)_redis_data") "redis volume is not project scoped"
  Assert-Text ($config -match "name:\s+$($runtime.ComposeProjectName)_minio_data") "minio volume is not project scoped"
  foreach ($port in $portValues) {
    Assert-Text ($config -match "published:\s+`"$port`"") "compose config is missing published port $port"
  }

  Write-Host "Compose instance verification passed." -ForegroundColor Green
  Write-Host "Instance: $($runtime.InstanceId)"
  Write-Host "Project : $($runtime.ComposeProjectName)"
  Write-Host "Env     : $($runtime.EnvPath)"
}
finally {
  Pop-Location
}
