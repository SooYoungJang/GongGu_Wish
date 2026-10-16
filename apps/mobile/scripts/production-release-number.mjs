import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { classifyChangedFiles } from "../../../scripts/ci-change-plan.mjs";

// Last Production commit that displayed the native build number (17).
const BASELINE_COMMIT = "56d9be3da082d3897be13600873ebc537e686e14";
const BASELINE_NUMBER = 17;

export function resolveProductionReleaseNumber({
  cwd = process.cwd(),
  baselineCommit = BASELINE_COMMIT,
} = {}) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const commits = git(["rev-list", "--first-parent", "HEAD"])
    .trim()
    .split(/\r?\n/);
  const distance = commits.indexOf(baselineCommit);
  if (distance < 0) {
    throw new Error(
      "Production release baseline is missing; fetch the full main history.",
    );
  }
  let mobileReleases = 0;
  for (const commit of commits.slice(0, distance)) {
    const files = git([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      `${commit}^1`,
      commit,
      "--",
    ])
      .split("\0")
      .filter(Boolean);
    if (files.length > 0 && classifyChangedFiles(files).mobile) {
      mobileReleases += 1;
    }
  }
  return String(BASELINE_NUMBER + mobileReleases);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(resolveProductionReleaseNumber());
}
