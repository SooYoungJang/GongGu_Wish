param(
  [string]$BuildRoot = "C:\codex-tools\work\GongGu_Wish",
  [ValidateSet("Debug", "Release")]
  [string]$BuildVariant = "Release",
  [string]$EnvFile = "",
  [switch]$AutomatedE2E
)

$ErrorActionPreference = "Stop"

function Add-ToPathIfExists([string]$PathToAdd) {
  if ($PathToAdd -and (Test-Path -LiteralPath $PathToAdd)) {
    $env:Path = "$PathToAdd;$env:Path"
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$allowedBuildRoot = [IO.Path]::GetFullPath("C:\codex-tools\work")
$BuildRoot = [IO.Path]::GetFullPath($BuildRoot)
if (-not $BuildRoot.StartsWith("$allowedBuildRoot\", [StringComparison]::OrdinalIgnoreCase)) {
  throw "BuildRoot must stay under C:\codex-tools\work"
}

if ($EnvFile) {
  $resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
  foreach ($line in Get-Content -LiteralPath $resolvedEnvFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }
    $parts = $trimmed.Split("=", 2)
    $name = $parts[0].Trim()
    if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      throw "Invalid environment variable name in EnvFile"
    }
    $value = $parts[1].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

if ($AutomatedE2E) {
  $env:EXPO_PUBLIC_E2E_MODE = "true"
  $env:EXPO_PUBLIC_SUPABASE_URL = "http://localhost:54321"
  $env:EXPO_PUBLIC_SUPABASE_ANON_KEY = "local-e2e-anon-key"
}

if ($BuildVariant -eq "Release" -and -not $env:NODE_ENV) {
  $env:NODE_ENV = "production"
}

$androidSdk = $env:ANDROID_HOME
if (-not $androidSdk) { $androidSdk = $env:ANDROID_SDK_ROOT }
if (-not $androidSdk -or -not (Test-Path -LiteralPath $androidSdk)) {
  $androidSdk = "C:\Android\Sdk"
}

$jdk = Get-ChildItem "C:\codex-tools\jdk17" -Directory -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $jdk) {
  throw "JDK 17 was not found under C:\codex-tools\jdk17"
}

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:ANDROID_AVD_HOME = "C:\Android\Avd"
$env:GRADLE_USER_HOME = "C:\Android\Gradle"
$env:TEMP = "C:\Android\Temp"
$env:TMP = "C:\Android\Temp"
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"
$env:GRADLE_OPTS = "-Dfile.encoding=UTF-8 -Djava.io.tmpdir=C:\Android\Temp"

New-Item -ItemType Directory -Force -Path $BuildRoot, $env:GRADLE_USER_HOME, $env:TEMP | Out-Null
Add-ToPathIfExists (Join-Path $env:JAVA_HOME "bin")
Add-ToPathIfExists (Join-Path $androidSdk "cmdline-tools\latest\bin")
Add-ToPathIfExists (Join-Path $androidSdk "platform-tools")
Add-ToPathIfExists (Join-Path $androidSdk "emulator")
Add-ToPathIfExists "C:\maestro\maestro\bin"

robocopy $RepoRoot $BuildRoot /E /MT:16 /R:1 /W:1 /XD .git .turbo .expo apps\mobile\android apps\mobile\.expo apps\mobile\.maestro\output /XF *.tsbuildinfo | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

$mobileRoot = Join-Path $BuildRoot "apps\mobile"
Push-Location $mobileRoot
try {
  npx expo prebuild --platform android --clean
  New-Item -ItemType Directory -Force -Path "android/app/src/main/assets", "android/app/src/main/res" | Out-Null
  npx expo export:embed --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
  Push-Location "android"
  try {
    $installTask = "install$BuildVariant"
    & .\gradlew.bat $installTask -x lint -x test --configure-on-demand --build-cache --no-daemon -PreactNativeArchitectures=x86_64
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle $installTask failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
