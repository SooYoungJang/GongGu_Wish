import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const fingerprint = process.argv[2] ?? "";
const repository = process.env.GITHUB_REPOSITORY ?? "";
const runnerTemp = process.env.RUNNER_TEMP ?? "";
const apkArtifactName = `gonggu-wish-preview-runtime-${fingerprint}`;
const baselineArtifactName = `${apkArtifactName}-baseline`;
const apiHeaders = [
  "-H",
  "Accept: application/vnd.github+json",
  "-H",
  "X-GitHub-Api-Version: 2022-11-28",
];

function warn(message) {
  process.stderr.write(`::warning::${message}\n`);
}

function gh(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error("GitHub API request failed");
  }
  return result.stdout;
}

function api(endpoint) {
  return JSON.parse(gh(["api", "--method", "GET", ...apiHeaders, endpoint]));
}

function numericId(value) {
  const id = String(value ?? "");
  return /^[0-9]+$/.test(id) ? id : "";
}

function trustedRun(run, workflowId, candidate) {
  return (
    numericId(run?.workflow_id) === workflowId &&
    run?.path === ".github/workflows/ci.yml" &&
    run?.status === "completed" &&
    run?.conclusion === "success" &&
    run?.event === "push" &&
    run?.head_branch === "develop" &&
    run?.head_sha === candidate.headSha
  );
}

function trustedManifest(manifest, candidate) {
  return (
    manifest?.schemaVersion === 1 &&
    manifest?.environment === "preview" &&
    manifest?.packageName === "com.gonggu.wish.preview" &&
    manifest?.mode === "build" &&
    manifest?.fingerprint === fingerprint &&
    manifest?.commitSha === candidate.headSha &&
    numericId(manifest?.workflowRunId) === candidate.runId &&
    manifest?.apkArtifactName === apkArtifactName &&
    /^[0-9a-f]{64}$/i.test(manifest?.apkSha256 ?? "") &&
    numericId(manifest?.apkArtifactId) !== ""
  );
}

function trustedApkArtifact(artifact, manifest, candidate) {
  return (
    numericId(artifact?.id) === numericId(manifest.apkArtifactId) &&
    artifact?.name === apkArtifactName &&
    artifact?.expired === false &&
    Number.isSafeInteger(artifact?.size_in_bytes) &&
    artifact.size_in_bytes > 0 &&
    numericId(artifact?.workflow_run?.id) === candidate.runId &&
    artifact?.workflow_run?.head_branch === "develop" &&
    artifact?.workflow_run?.head_sha === candidate.headSha
  );
}

function downloadManifest(candidate) {
  const directory = mkdtempSync(join(runnerTemp, "preview-baseline-"));
  try {
    gh([
      "run",
      "download",
      candidate.runId,
      "--repo",
      repository,
      "--name",
      baselineArtifactName,
      "--dir",
      directory,
    ]);
    const files = readdirSync(directory);
    if (files.length !== 1 || files[0] !== "preview-runtime-baseline.json") {
      return null;
    }
    return JSON.parse(
      readFileSync(join(directory, "preview-runtime-baseline.json"), "utf8"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function candidatesFrom(response) {
  const artifacts = Array.isArray(response?.artifacts)
    ? response.artifacts
    : [];
  const totalCount = Number(response?.total_count ?? artifacts.length);
  if (!Number.isSafeInteger(totalCount) || totalCount > artifacts.length) {
    return [];
  }
  return artifacts
    .filter((artifact) => {
      const runId = numericId(artifact?.workflow_run?.id);
      const headSha = artifact?.workflow_run?.head_sha ?? "";
      return (
        artifact?.name === baselineArtifactName &&
        artifact?.expired === false &&
        artifact?.workflow_run?.head_branch === "develop" &&
        numericId(artifact?.id) !== "" &&
        runId !== "" &&
        /^[0-9a-f]{40}$/i.test(headSha)
      );
    })
    .sort((left, right) =>
      String(right.created_at ?? "").localeCompare(
        String(left.created_at ?? ""),
      ),
    )
    .map((artifact) => ({
      artifactId: numericId(artifact.id),
      runId: numericId(artifact.workflow_run.id),
      headSha: artifact.workflow_run.head_sha,
    }));
}

function findBaseline() {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(fingerprint)) {
    throw new Error("Preview fingerprint is invalid");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY is unavailable");
  }
  if (!runnerTemp) {
    throw new Error("RUNNER_TEMP is unavailable");
  }

  const workflowId = numericId(
    api(`/repos/${repository}/actions/workflows/ci.yml`).id,
  );
  if (!workflowId) {
    throw new Error("CI workflow ID is invalid");
  }

  const artifactResponse = api(
    `/repos/${repository}/actions/artifacts?name=${encodeURIComponent(
      baselineArtifactName,
    )}&per_page=100`,
  );
  for (const candidate of candidatesFrom(artifactResponse)) {
    try {
      const run = api(`/repos/${repository}/actions/runs/${candidate.runId}`);
      if (!trustedRun(run, workflowId, candidate)) continue;

      const manifest = downloadManifest(candidate);
      if (!trustedManifest(manifest, candidate)) continue;

      const apkArtifact = api(
        `/repos/${repository}/actions/artifacts/${numericId(
          manifest.apkArtifactId,
        )}`,
      );
      if (!trustedApkArtifact(apkArtifact, manifest, candidate)) continue;

      return numericId(manifest.apkArtifactId);
    } catch {
      continue;
    }
  }
  return "";
}

try {
  process.stdout.write(findBaseline());
} catch (error) {
  warn(
    `${error instanceof Error ? error.message : "Preview baseline lookup failed"}; building a new Preview APK baseline.`,
  );
}
