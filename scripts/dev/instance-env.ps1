$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  param([string]$ScriptDirectory)
  return (Resolve-Path (Join-Path $ScriptDirectory '..\..')).Path
}

function Read-DotEnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') {
      continue
    }
    $match = [regex]::Match($line, '^\s*([^=]+?)\s*=(.*)$')
    if (-not $match.Success) {
      continue
    }
    $name = $match.Groups[1].Value.Trim()
    $value = $match.Groups[2].Value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
  }

  return $values
}

function Write-DotEnvFile {
  param(
    [string]$Path,
    $Values
  )

  $directory = Split-Path -Parent $Path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  $lines = foreach ($key in ($Values.Keys | Sort-Object)) {
    '{0}={1}' -f $key, $Values[$key]
  }
  Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Import-DotEnvToProcess {
  param([string]$Path)

  $values = Read-DotEnvFile -Path $Path
  foreach ($key in $values.Keys) {
    [Environment]::SetEnvironmentVariable($key, [string]$values[$key], 'Process')
  }
  return $values
}

function Get-StableHash {
  param([string]$Value)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
    $hash = $sha.ComputeHash($bytes)
    $hex = ($hash | ForEach-Object { $_.ToString('x2') }) -join ''
    return $hex.Substring(0, 12)
  }
  finally {
    $sha.Dispose()
  }
}

function ConvertTo-InstanceId {
  param(
    [string]$Candidate,
    [string]$FallbackSeed
  )

  $raw = if ([string]::IsNullOrWhiteSpace($Candidate)) { 'local' + (Get-StableHash -Value $FallbackSeed) } else { $Candidate.ToLowerInvariant() }
  $sanitized = [regex]::Replace($raw, '[^a-z0-9]', '')
  if ([string]::IsNullOrWhiteSpace($sanitized)) {
    return 'local' + (Get-StableHash -Value $FallbackSeed)
  }
  return $sanitized
}

function Get-UsedTcpPorts {
  $ports = [System.Collections.Generic.HashSet[int]]::new()

  try {
    Get-NetTCPConnection -ErrorAction Stop |
      Where-Object { $_.State -in @('Listen', 'Bound') } |
      Select-Object -ExpandProperty LocalPort -Unique |
      ForEach-Object { [void]$ports.Add([int]$_) }
  }
  catch {
    $netstat = netstat.exe -ano -p tcp 2>$null
    foreach ($line in $netstat) {
      if ($line -notmatch '\bLISTENING\b') {
        continue
      }
      $match = [regex]::Match($line, '(?:\d{1,3}\.){3}\d{1,3}:(\d+)|\[[^\]]+\]:(\d+)|\*:(\d+)')
      if ($match.Success) {
        $value = ($match.Groups | Where-Object { $_.Success -and $_.Value -match '^\d+$' } | Select-Object -Last 1).Value
        if ($value) {
          [void]$ports.Add([int]$value)
        }
      }
    }
  }

  foreach ($family in @('ipv4', 'ipv6')) {
    try {
      $excluded = netsh.exe interface $family show excludedportrange protocol=tcp 2>$null
      foreach ($line in $excluded) {
        $match = [regex]::Match($line.Trim(), '^(\d+)\s+(\d+)')
        if (-not $match.Success) {
          continue
        }
        $start = [int]$match.Groups[1].Value
        $end = [int]$match.Groups[2].Value
        for ($port = $start; $port -le $end -and $port -le 65535; $port++) {
          [void]$ports.Add($port)
        }
      }
    }
    catch {
    }
  }

  return $ports
}

function Test-TcpPortAvailable {
  param([int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Get-FreeTcpPort {
  param(
    [int]$PreferredPort,
    [System.Collections.Generic.HashSet[int]]$ReservedPorts,
    [System.Collections.Generic.HashSet[int]]$UsedPorts
  )

  if (-not $ReservedPorts.Contains($PreferredPort) -and -not $UsedPorts.Contains($PreferredPort) -and (Test-TcpPortAvailable -Port $PreferredPort)) {
    [void]$ReservedPorts.Add($PreferredPort)
    return $PreferredPort
  }

  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 0)
    try {
      $listener.Start()
      $port = $listener.LocalEndpoint.Port
    }
    finally {
      $listener.Stop()
    }

    if (-not $ReservedPorts.Contains($port) -and -not $UsedPorts.Contains($port) -and (Test-TcpPortAvailable -Port $port)) {
      [void]$ReservedPorts.Add($port)
      return $port
    }
  }

  throw 'Unable to allocate a free port.'
}

function Get-ComposeProjectPublishedPorts {
  param([string]$ComposeProjectName)

  $ports = [System.Collections.Generic.HashSet[int]]::new()
  try {
    $dockerArgs = @('ps', '--filter', ('label=com.docker.compose.project=' + $ComposeProjectName), '--format', '{{.Ports}}')
    $lines = & docker @dockerArgs 2>$null
    foreach ($line in $lines) {
      foreach ($match in [regex]::Matches($line, ':(\d+)->')) {
        [void]$ports.Add([int]$match.Groups[1].Value)
      }
    }
  }
  catch {
  }
  return $ports
}

function New-StableSecret {
  param([string]$Seed)

  $bytes = [System.Text.Encoding]::UTF8.GetBytes(('yunwu-session-secret-{0}' -f $Seed))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hex = (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
    return $hex
  }
  finally {
    $sha.Dispose()
  }
}

function Resolve-YunwuRuntimeEnv {
  param(
    [string]$RepoRoot,
    [switch]$ForceRegeneratePorts
  )

  $scriptRuntimeDir = Join-Path $RepoRoot 'scripts\dev\.runtime'
  $runtimeEnvPath = Join-Path $scriptRuntimeDir 'local.env'
  $baseEnvPath = Join-Path $RepoRoot '.env'
  $exampleEnvPath = Join-Path $RepoRoot '.env.example'

  if (-not (Test-Path $baseEnvPath) -and (Test-Path $exampleEnvPath)) {
    Copy-Item $exampleEnvPath $baseEnvPath
  }

  $base = Read-DotEnvFile -Path $baseEnvPath
  $existing = Read-DotEnvFile -Path $runtimeEnvPath
  $values = [ordered]@{}
  foreach ($key in $base.Keys) { $values[$key] = $base[$key] }
  foreach ($key in $existing.Keys) { $values[$key] = $existing[$key] }

  $candidateInstanceId = $env:YUNWU_INSTANCE_ID
  if ([string]::IsNullOrWhiteSpace($candidateInstanceId)) { $candidateInstanceId = $base['YUNWU_INSTANCE_ID'] }
  $instanceId = ConvertTo-InstanceId -Candidate $candidateInstanceId -FallbackSeed $RepoRoot
  $composeProjectName = 'yunwu-' + $instanceId

  $reserved = [System.Collections.Generic.HashSet[int]]::new()
  $used = Get-UsedTcpPorts
  $ownPublished = Get-ComposeProjectPublishedPorts -ComposeProjectName $composeProjectName
  if ($null -eq $ownPublished) { $ownPublished = [System.Collections.Generic.HashSet[int]]::new() }

  function Resolve-PortValue([string]$Name, [int]$Preferred) {
    $existingPort = 0
    $hasExistingPort = [int]::TryParse([string]$values[$Name], [ref]$existingPort)
    if (-not $ForceRegeneratePorts -and $hasExistingPort -and $existingPort -gt 0) {
      $availableForThisRun = (-not $used.Contains($existingPort)) -and (Test-TcpPortAvailable -Port $existingPort)
      if (-not $reserved.Contains($existingPort) -and ($ownPublished.Contains($existingPort) -or $availableForThisRun)) {
        [void]$reserved.Add($existingPort)
        return $existingPort
      }
    }
    return Get-FreeTcpPort -PreferredPort $Preferred -ReservedPorts $reserved -UsedPorts $used
  }

  $apiPort = Resolve-PortValue -Name 'PORT' -Preferred 3000
  $webPort = Resolve-PortValue -Name 'WEB_PORT' -Preferred 5173
  $postgresPort = Resolve-PortValue -Name 'POSTGRES_PORT' -Preferred 5432
  $redisPort = Resolve-PortValue -Name 'REDIS_PORT' -Preferred 6379
  $minioPort = Resolve-PortValue -Name 'MINIO_PORT' -Preferred 9000
  $minioConsolePort = Resolve-PortValue -Name 'MINIO_CONSOLE_PORT' -Preferred 9001

  $sessionSecret = if ($existing['AUTH_SESSION_SECRET'] -and $existing['AUTH_SESSION_SECRET'] -ne 'yunwu-dev-session-secret-change-me') {
    $existing['AUTH_SESSION_SECRET']
  }
  else {
    New-StableSecret -Seed ($RepoRoot + '/' + $instanceId)
  }

  $postgresUser = if ($values['POSTGRES_USER']) { $values['POSTGRES_USER'] } else { 'postgres' }
  $postgresPassword = if ($values['POSTGRES_PASSWORD']) { $values['POSTGRES_PASSWORD'] } else { 'postgres' }
  $postgresDb = if ($values['POSTGRES_DB']) { $values['POSTGRES_DB'] } else { 'yunwu_platform' }

  $values['YUNWU_INSTANCE_ID'] = $instanceId
  $values['COMPOSE_PROJECT_NAME'] = $composeProjectName
  $values['AUTH_COOKIE_NAME'] = 'yunwu_session_' + $instanceId
  $values['AUTH_SESSION_SECRET'] = $sessionSecret
  $values['PORT'] = [string]$apiPort
  $values['WEB_PORT'] = [string]$webPort
  $values['POSTGRES_PORT'] = [string]$postgresPort
  $values['REDIS_PORT'] = [string]$redisPort
  $values['MINIO_PORT'] = [string]$minioPort
  $values['MINIO_CONSOLE_PORT'] = [string]$minioConsolePort
  $values['DATABASE_URL'] = 'postgresql://{0}:{1}@localhost:{2}/{3}?schema=public' -f $postgresUser, $postgresPassword, $postgresPort, $postgresDb
  $values['REDIS_URL'] = 'redis://localhost:{0}' -f $redisPort
  $values['MINIO_ENDPOINT'] = 'localhost'
  $values['MINIO_PUBLIC_BASE_URL'] = 'http://127.0.0.1:{0}/api/assets' -f $apiPort
  $values['PUBLIC_ASSET_BASE_URL'] = 'http://127.0.0.1:{0}/api/assets' -f $apiPort
  $values['CORS_ORIGIN'] = 'http://127.0.0.1:{0},http://localhost:{0}' -f $webPort
  $values['WEB_ORIGIN'] = 'http://127.0.0.1:{0}' -f $webPort
  $values['VITE_API_BASE_URL'] = 'http://127.0.0.1:{0}' -f $apiPort

  Write-DotEnvFile -Path $runtimeEnvPath -Values $values

  return [pscustomobject]@{
    InstanceId = $instanceId
    ComposeProjectName = $composeProjectName
    EnvPath = $runtimeEnvPath
    Values = $values
    Ports = [pscustomobject]@{
      Api = $apiPort
      Web = $webPort
      Postgres = $postgresPort
      Redis = $redisPort
      Minio = $minioPort
      MinioConsole = $minioConsolePort
    }
  }
}

function Get-YunwuComposeArgs {
  param(
    [string]$RepoRoot,
    [string]$EnvPath,
    [switch]$App
  )

  $args = @('compose', '--env-file', $EnvPath, '-f', (Join-Path $RepoRoot 'infra\docker-compose.yml'))
  if ($App) {
    $args += @('-f', (Join-Path $RepoRoot 'infra\docker-compose.app.yml'))
  }
  return $args
}
