[CmdletBinding()]
param(
  [ValidateSet("local", "preview", "production")]
  [string]$Target = "preview",
  [switch]$AllowProductionWrites
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$python = if ($env:PYTHON) { $env:PYTHON } else { "python" }

if ($Target -eq "production" -and -not $AllowProductionWrites) {
  throw "Production 수집은 -AllowProductionWrites를 명시해야 합니다."
}

Push-Location $repoRoot
try {
  Push-Location (Join-Path $repoRoot "workers/instagram")
  $env:INSTAGRAM_COLLECTION_TARGET = $Target
  $env:INSTAGRAM_PUBLIC_CRAWLER_ENABLED = "true"
  if ($Target -eq "production") {
    $env:INSTAGRAM_ALLOW_PRODUCTION_WRITES = "true"
  }

  & $python -m unittest test_target.py test_public_main.py test_public_parser.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & $python -m compileall -q .
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($Target -eq "production") {
    $env:INSTAGRAM_PRODUCTION_PREFLIGHT_PASSED = "true"
  }

  & $python public_main.py
  exit $LASTEXITCODE
}
finally {
  Pop-Location
  Pop-Location
}
