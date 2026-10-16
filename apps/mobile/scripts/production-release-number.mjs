import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Last Production commit that displayed the native build number (17).
const BASELINE_COMMIT = "56d9be3da082d3897be13600873ebc537e686e14";
const BASELINE_NUMBER = 17;

export function resolveProductionReleaseNumber({
  cwd = process.cwd(),
  baselineCommit = BASELINE_COMMIT,
} = {}) {
  const commits = execFileSync("git", ["rev-list", "--first-parent", "HEAD"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .trim()
    .split(/\r?\n/);
  const distance = commits.indexOf(baselineCommit);
  if (distance < 0) {
    throw new Error(
      "Production release baseline is missing; fetch the full main history.",
    );
  }
  return String(BASELINE_NUMBER + distance);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(resolveProductionReleaseNumber());
}
