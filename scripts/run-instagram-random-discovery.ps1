[CmdletBinding()]
param(
  [ValidateSet("local", "preview", "production")]
  [string]$Target = "preview",

  [ValidateRange(1, 50)]
  [int]$TargetGroupBuys = 3,

  [ValidateRange(60, 3600)]
  [int]$TimeBudgetSeconds = 900,

  [ValidateRange(0, 10)]
  [int]$ScrollPasses = 3,

  [string[]]$Hashtags = @("공구", "공동구매", "공구오픈", "공구마감", "마켓오픈", "오픈예정"),

  [ValidateRange(0, 10000)]
  [int]$EmergencyMaxAccounts = 0,

  [switch]$AllowProductionWrites
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot "run-instagram-public-collector.ps1"
$managedVariables = @(
  "PYTHON",
  "INSTAGRAM_PUBLIC_WATCHLIST_ENABLED",
  "INSTAGRAM_RANDOM_DISCOVERY_ENABLED",
  "INSTAGRAM_PUBLIC_RUN_ONCE",
  "INSTAGRAM_PUBLIC_POST_LIMIT",
  "INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS",
  "INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS",
  "INSTAGRAM_DISCOVERY_SCROLL_PASSES",
  "INSTAGRAM_DISCOVERY_HASHTAGS",
  "INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS"
)
$previousValues = @{}
foreach ($name in $managedVariables) {
  $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

$exitCode = 1
try {
  $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
  if (-not $env:PYTHON -and (Test-Path -LiteralPath $venvPython)) {
    $env:PYTHON = $venvPython
  }
  $env:INSTAGRAM_PUBLIC_WATCHLIST_ENABLED = "false"
  $env:INSTAGRAM_RANDOM_DISCOVERY_ENABLED = "true"
  $env:INSTAGRAM_PUBLIC_RUN_ONCE = "true"
  $env:INSTAGRAM_PUBLIC_POST_LIMIT = "3"
  $env:INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS = [string]$TargetGroupBuys
  $env:INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS = [string]$TimeBudgetSeconds
  $env:INSTAGRAM_DISCOVERY_SCROLL_PASSES = [string]$ScrollPasses
  $env:INSTAGRAM_DISCOVERY_HASHTAGS = $Hashtags -join ","
  if ($EmergencyMaxAccounts -gt 0) {
    $env:INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS = [string]$EmergencyMaxAccounts
  }
  else {
    [Environment]::SetEnvironmentVariable(
      "INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS",
      $null,
      "Process"
    )
  }

  if ($AllowProductionWrites) {
    & $runner -Target $Target -AllowProductionWrites
  }
  else {
    & $runner -Target $Target
  }
  $exitCode = $LASTEXITCODE
}
finally {
  foreach ($name in $managedVariables) {
    [Environment]::SetEnvironmentVariable($name, $previousValues[$name], "Process")
  }
}

exit $exitCode
