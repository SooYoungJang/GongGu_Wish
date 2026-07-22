[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("fetch", "push")]
  [string]$Operation,

  [Parameter(Mandatory = $true, Position = 1)]
  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string]$Branch,

  [ValidatePattern("^[A-Za-z0-9._-]+$")]
  [string]$Remote = "origin",

  [string]$Repository = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $env:LOCALAPPDATA) {
  throw "LOCALAPPDATA is required to provision the pure-JavaScript Git client."
}

$isomorphicGitVersion = "1.38.10"
$toolRoot = Join-Path $env:LOCALAPPDATA "gonggu-wish-tools\isomorphic-git-$isomorphicGitVersion"
$packageRoot = Join-Path $toolRoot "node_modules\isomorphic-git"
$packageManifest = Join-Path $packageRoot "package.json"

if (-not (Test-Path -LiteralPath $packageManifest)) {
  New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
  & npm install `
    --prefix $toolRoot `
    --no-save `
    --package-lock=false `
    --ignore-scripts `
    --no-audit `
    --no-fund `
    "isomorphic-git@$isomorphicGitVersion"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to provision isomorphic-git $isomorphicGitVersion."
  }
}

if (-not (Test-Path -LiteralPath $packageManifest)) {
  throw "isomorphic-git was not found after provisioning."
}

$repositoryPath = (Resolve-Path -LiteralPath $Repository).Path
$commonGitDir = (& git -C $repositoryPath rev-parse --path-format=absolute --git-common-dir).Trim()
if ($LASTEXITCODE -ne 0 -or -not $commonGitDir) {
  throw "Could not resolve the repository common Git directory."
}

$env:GGW_GIT_OPERATION = $Operation
$env:GGW_GIT_BRANCH = $Branch
$env:GGW_GIT_REMOTE = $Remote
$env:GGW_GIT_REPOSITORY = $repositoryPath
$env:GGW_GIT_COMMON_DIR = $commonGitDir
$env:GGW_ISOMORPHIC_GIT_PACKAGE = $packageRoot

$nodeSource = @'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const packageRoot = process.env.GGW_ISOMORPHIC_GIT_PACKAGE;
const git = require(packageRoot);
const http = require(path.join(packageRoot, "http/node"));

const operation = process.env.GGW_GIT_OPERATION;
const branch = process.env.GGW_GIT_BRANCH;
const remote = process.env.GGW_GIT_REMOTE;
const dir = process.env.GGW_GIT_REPOSITORY;
const gitdir = process.env.GGW_GIT_COMMON_DIR;

function getGitHubCredentials() {
  const token = execFileSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!token) throw new Error("gh auth token returned an empty token");
  return { username: "x-access-token", password: token };
}

async function main() {
  if (operation === "fetch") {
    await git.fetch({
      fs,
      http,
      dir,
      gitdir,
      remote,
      ref: branch,
      singleBranch: true,
      tags: false,
      prune: false,
      onAuth: getGitHubCredentials,
    });
    const oid = await git.resolveRef({
      fs,
      dir,
      gitdir,
      ref: `refs/remotes/${remote}/${branch}`,
    });
    console.log(`fetched ${remote}/${branch} ${oid}`);
    return;
  }

  const result = await git.push({
    fs,
    http,
    dir,
    gitdir,
    remote,
    ref: branch,
    remoteRef: branch,
    onAuth: getGitHubCredentials,
  });
  if (result?.errors?.length) {
    throw new Error(result.errors.join("\n"));
  }
  console.log(`pushed ${branch} to ${remote}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
'@

$nodeSource | & node -
if ($LASTEXITCODE -ne 0) {
  throw "The $Operation operation failed for $Remote/$Branch."
}
