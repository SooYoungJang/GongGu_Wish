param(
  [string]$Flows = ".maestro/mobile-e2e-evidence-flow.yaml",
  [int]$Attempts = 3,
  [int]$RecordTimeoutSeconds = 90,
  [string]$OutputRoot = "apps/mobile/.maestro/output/recordings"
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Add-ToPathIfExists([string]$PathToAdd) {
  if ($PathToAdd -and (Test-Path -LiteralPath $PathToAdd)) {
    $env:Path = "$PathToAdd;$env:Path"
  }
}

$androidSdk = $env:ANDROID_HOME
if (-not $androidSdk) { $androidSdk = $env:ANDROID_SDK_ROOT }
if (-not $androidSdk) { $androidSdk = "C:\Android\Sdk" }
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:MAESTRO_CLI_NO_ANALYTICS = "1"
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = "true"

Add-ToPathIfExists (Join-Path $androidSdk "platform-tools")
Add-ToPathIfExists "C:\maestro\maestro\bin"
Add-ToPathIfExists "C:\maestro\bin"

if (-not $env:JAVA_HOME) {
  $portableJdk = Get-ChildItem "C:\codex-tools\jdk17" -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($portableJdk) { $env:JAVA_HOME = $portableJdk.FullName }
}
Add-ToPathIfExists (Join-Path $env:JAVA_HOME "bin")

$maestro = (Get-Command maestro -ErrorAction SilentlyContinue).Source
if (-not $maestro -and (Test-Path "C:\maestro\maestro\bin\maestro.bat")) { $maestro = "C:\maestro\maestro\bin\maestro.bat" }
if (-not $maestro) { throw "Maestro CLI를 찾지 못했습니다." }
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw "adb를 찾지 못했습니다." }
if (-not (adb devices | Select-String -Pattern "`tdevice$")) { throw "연결된 Android 기기가 없습니다." }

$flowList = $Flows -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$verifyScript = Join-Path $repoRoot "scripts\verify-e2e-videos.mjs"
$failures = @()

foreach ($flow in $flowList) {
  $flowName = [IO.Path]::GetFileNameWithoutExtension($flow)
  $passed = $false
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    $attemptDir = Join-Path $OutputRoot "$flowName\attempt-$attempt"
    New-Item -ItemType Directory -Force -Path $attemptDir | Out-Null
    $recordPath = Join-Path $attemptDir "$flowName.mp4"
    Write-Host "`n[Maestro E2E] $flow 시도 $attempt/$Attempts"

    & $maestro --no-ansi test $flow
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Maestro 사용자 흐름 실패: $flow"
      continue
    }

    $recordArgs = @("record", "--local", $flow, $recordPath)
    $recordProcess = Start-Process -FilePath $maestro -ArgumentList $recordArgs -WindowStyle Hidden -PassThru
    $finished = $recordProcess.WaitForExit($RecordTimeoutSeconds * 1000)
    if (-not $finished) {
      Write-Warning "녹화 제한 시간 초과 — recorder 프로세스를 종료하고 재시도합니다."
      taskkill /PID $recordProcess.Id /T /F | Out-Null
      continue
    }
    if ($recordProcess.ExitCode -ne 0) {
      Write-Warning "Maestro 녹화 명령 실패 (exit=$($recordProcess.ExitCode) )"
      continue
    }

    & node $verifyScript --dir $attemptDir --extensions .mp4
    if ($LASTEXITCODE -eq 0) {
      $passed = $true
      break
    }
    Write-Warning "녹화 파일 검증 실패 — 재시도합니다."
  }

  if (-not $passed) { $failures += $flow }
}

if ($failures.Count -gt 0) {
  throw "E2E 실패: 테스트 또는 녹화가 $Attempts회 시도 후에도 통과하지 못함 ($($failures -join ', '))"
}

Write-Host "`n[Maestro E2E] 모든 흐름 테스트·녹화·duration 검증 PASS"
