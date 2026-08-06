import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const RELEASE_MANIFEST_VERSION = 1;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashFile(path) {
  return sha256(readFileSync(path));
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function listMigrationFiles(root = "supabase/migrations") {
  return listFiles(root)
    .filter((path) => path.endsWith(".sql"))
    .map((path) => ({
      name: relative(root, path).replaceAll("\\", "/"),
      sha256: hashFile(path),
    }));
}

export function listEdgeFunctionFiles(root = "supabase/functions") {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = join(root, entry.name);
      const files = listFiles(directory).map((path) => ({
        name: relative(directory, path).replaceAll("\\", "/"),
        sha256: hashFile(path),
      }));
      return {
        name: entry.name,
        sha256: sha256(JSON.stringify(files)),
        files,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function resolveSourceSha(sourceSha) {
  if (sourceSha) return sourceSha;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

export function buildReleaseManifest({
  environment,
  projectRef,
  sourceSha,
  mobileDeployment = null,
  workerSha = null,
  root = ".",
}) {
  if (!environment || !["preview", "production"].includes(environment)) {
    throw new Error("environment must be preview or production");
  }
  if (!projectRef) throw new Error("projectRef is required");
  const migrations = listMigrationFiles(join(root, "supabase/migrations"));
  const edgeFunctions = listEdgeFunctionFiles(join(root, "supabase/functions"));
  const resolvedSha = resolveSourceSha(sourceSha);
  return {
    schemaVersion: RELEASE_MANIFEST_VERSION,
    releaseId: `${environment}:${resolvedSha}`,
    environment,
    projectRef,
    sourceSha: resolvedSha,
    migrations,
    edgeFunctions,
    workerSha: workerSha || null,
    mobileDeployment:
      mobileDeployment?.mode ||
      mobileDeployment?.fingerprint ||
      mobileDeployment?.runtimeVersion
        ? mobileDeployment
        : null,
  };
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function main() {
  const args = process.argv.slice(2);
  const output = readOption(args, "--output");
  const manifest = buildReleaseManifest({
    environment: readOption(args, "--environment"),
    projectRef: readOption(args, "--project-ref"),
    sourceSha: readOption(args, "--source-sha"),
    workerSha: readOption(args, "--worker-sha"),
    root: readOption(args, "--root") ?? ".",
    mobileDeployment: {
      mode: readOption(args, "--mobile-mode"),
      fingerprint: readOption(args, "--mobile-fingerprint"),
      runtimeVersion: readOption(args, "--mobile-runtime-version"),
    },
  });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (output) writeFileSync(output, serialized);
  else process.stdout.write(serialized);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
