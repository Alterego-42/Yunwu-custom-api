param(
  [string]$RepoRoot
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
else {
  $RepoRoot = (Resolve-Path $RepoRoot).Path
}

function Test-LfShellScript {
  param([string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
    throw "Shell script contains a UTF-8 BOM: $Path"
  }
  for ($index = 0; $index -lt $bytes.Length; $index++) {
    if ($bytes[$index] -eq 13) {
      throw "Shell script contains CR/CRLF line endings: $Path"
    }
  }
}

$paths = @()
$paths += Get-ChildItem -Path (Join-Path $RepoRoot "infra\scripts") -Filter "*.sh" -File -ErrorAction Stop

$releaseRoot = Join-Path $RepoRoot "apps\desktop\release"
if (Test-Path $releaseRoot) {
  $paths += Get-ChildItem -Path $releaseRoot -Recurse -Filter "*.sh" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*\resources\infra\scripts\*" }
}

if ($paths.Count -eq 0) {
  throw "No shell scripts found to verify."
}

foreach ($path in $paths) {
  Test-LfShellScript -Path $path.FullName
}

Write-Host "Shell script line ending verification passed." -ForegroundColor Green
foreach ($path in $paths) {
  Write-Host $path.FullName
}
