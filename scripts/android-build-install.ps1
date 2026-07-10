param(
  [string]$BuildRoot = "C:\codex-tools\work\GongGu_Wish"
)

$ErrorActionPreference = "Stop"

function Add-ToPathIfExists([string]$PathToAdd) {
  if ($PathToAdd -and (Test-Path -LiteralPath $PathToAdd)) {
    $env:Path = "$PathToAdd;$env:Path"
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $BuildRoot.StartsWith("C:\codex-tools\work\")) {
  throw "BuildRoot must stay under C:\codex-tools\work"
}

$androidSdk = $env:ANDROID_HOME
if (-not $androidSdk) { $androidSdk = $env:ANDROID_SDK_ROOT }
if (-not (Test-Path -LiteralPath $androidSdk)) { $androidSdk = "C:\Android\Sdk" }

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
    .\gradlew.bat installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeArchitectures=x86_64
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
