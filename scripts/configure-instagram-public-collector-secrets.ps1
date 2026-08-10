[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$StorageStatePath,

  [string]$Repository = "SooYoungJang/GongGu_Wish",

  [switch]$UseCurrentUserCollectorToken
)

$ErrorActionPreference = "Stop"

if ($Repository -notmatch "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") {
  throw "Repository must be in OWNER/REPOSITORY format."
}

$storageStateFile = Get-Item -LiteralPath $StorageStatePath -ErrorAction Stop
if ($storageStateFile.PSIsContainer) {
  throw "StorageStatePath must point to a file."
}
if ($storageStateFile.Length -gt 48KB) {
  throw "storageState is larger than GitHub's 48 KiB secret limit."
}

$storageBytes = [System.IO.File]::ReadAllBytes($storageStateFile.FullName)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
try {
  $storageText = $utf8.GetString($storageBytes)
  $storageState = $storageText | ConvertFrom-Json
} catch {
  throw "Storage state must be valid UTF-8 JSON."
}

if ($null -eq $storageState -or $storageState -is [System.Array]) {
  throw "Storage state must be a JSON object."
}

$gh = Get-Command gh -ErrorAction Stop

function Set-GitHubSecretFromBytes {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [byte[]]$Bytes
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $gh.Source
  $startInfo.Arguments = "secret set $Name --repo $Repository --env production"
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $process.StandardInput.BaseStream.Write($Bytes, 0, $Bytes.Length)
  $process.StandardInput.Close()
  [void]$process.StandardOutput.ReadToEnd()
  [void]$process.StandardError.ReadToEnd()
  $process.WaitForExit()

  if ($process.ExitCode -ne 0) {
    throw "Failed to set GitHub secret $Name (gh exit code $($process.ExitCode))."
  }
}

Set-GitHubSecretFromBytes -Name "INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON" -Bytes $storageBytes
Write-Output "Set INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON in the production Environment."

if ($UseCurrentUserCollectorToken) {
  $collectorToken = [Environment]::GetEnvironmentVariable(
    "INSTAGRAM_COLLECTOR_TOKEN",
    [EnvironmentVariableTarget]::User
  )
  if ([string]::IsNullOrWhiteSpace($collectorToken)) {
    throw "The current Windows user does not have INSTAGRAM_COLLECTOR_TOKEN."
  }
  $collectorToken = $collectorToken.Trim()
  $tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($collectorToken)
  Set-GitHubSecretFromBytes -Name "INSTAGRAM_COLLECTOR_TOKEN" -Bytes $tokenBytes
  Write-Output "Set INSTAGRAM_COLLECTOR_TOKEN in the production Environment."
}

Write-Output "Do not commit the storageState file; remove the local copy after verifying the secret list."
