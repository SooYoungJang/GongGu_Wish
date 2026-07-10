param(
  [string]$Flow = "apps/mobile/.maestro/smoke.yaml",
  [string]$OutputDir = "apps/mobile/.maestro/output"
)

$ErrorActionPreference = "Stop"

function Add-ToPathIfExists([string]$PathToAdd) {
  if ($PathToAdd -and (Test-Path -LiteralPath $PathToAdd)) {
    $env:Path = "$PathToAdd;$env:Path"
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$androidSdk = $env:ANDROID_HOME
if (-not $androidSdk) { $androidSdk = $env:ANDROID_SDK_ROOT }
if (-not $androidSdk) { $androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path -LiteralPath $androidSdk)) { $androidSdk = "C:\Android\Sdk" }

$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:ANDROID_AVD_HOME = "C:\Android\Avd"
$env:MAESTRO_CLI_NO_ANALYTICS = "1"
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = "true"

Add-ToPathIfExists (Join-Path $androidSdk "platform-tools")
Add-ToPathIfExists (Join-Path $androidSdk "emulator")
Add-ToPathIfExists "C:\maestro\bin"
Add-ToPathIfExists "C:\maestro\maestro\bin"
Add-ToPathIfExists (Join-Path $env:USERPROFILE ".maestro\bin")

if (-not $env:JAVA_HOME) {
  $portableJdk = Get-ChildItem "C:\codex-tools\jdk17" -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $portableJdk) {
    $portableJdk = Get-ChildItem "C:\codex-tools\jdk" -Directory -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
  }
  if ($portableJdk) {
    $env:JAVA_HOME = $portableJdk.FullName
  }
}

Add-ToPathIfExists (Join-Path $env:JAVA_HOME "bin")

$missing = @()
foreach ($command in @("java", "adb", "maestro")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    $missing += $command
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing required command(s): " + ($missing -join ", ") + ". Install Java 17+, Android SDK platform-tools, and Maestro CLI first.")
}

$devices = adb devices | Select-String -Pattern "`tdevice$"
if (-not $devices) {
  Write-Error "No Android emulator/device is connected. Start GongGu_API_34 or another Android emulator, then rerun this script."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
maestro --no-ansi test $Flow --test-output-dir $OutputDir
