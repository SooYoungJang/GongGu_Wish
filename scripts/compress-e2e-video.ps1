param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$MaxWidth = 480,
  [int]$Crf = 30
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
if (-not (Test-Path -LiteralPath $InputPath)) { throw "입력 영상이 없습니다: $InputPath" }

$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg -and $env:LOCALAPPDATA) {
  $ffmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter ffmpeg.exe -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $ffmpeg) { throw "ffmpeg를 찾지 못했습니다." }

$parent = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$scale = "scale='min($MaxWidth,iw)':-2:flags=lanczos"
& $ffmpeg -y -i $InputPath -vf $scale -c:v libx264 -preset medium -crf $Crf -pix_fmt yuv420p -movflags +faststart -an $OutputPath
if ($LASTEXITCODE -ne 0) { throw "ffmpeg 압축 실패 (exit=$LASTEXITCODE)" }

Write-Host "압축 완료: $OutputPath"
