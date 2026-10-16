import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Exact, reviewed EOL-only equivalence, not a general runtime override.
// Both 175-entry ordered fingerprint transcripts were reproduced. Only
// eas.json, the ProGuard plugin, patches, and the patched SDK's added-line
// endings differ. SDK 16.3.4 tarball integrity and both directory hashes
// were verified; no native API/config changes are accepted by this mapping.
const currentFingerprint = "0b37911db44a8039b54b904a2a76843a46733511";
const legacyTarget = Object.freeze({
  runtimeVersion: "03cb2d49ed9bcaa616a8d38f969acfb7511c6101",
  buildId: "0efa1ce7-b2bc-4f40-852b-365302f1d38a",
});

export function getLegacyRuntime(environment, fingerprint) {
  return environment === "production" && fingerprint === currentFingerprint
    ? legacyTarget
    : undefined;
}

export function validateLegacyBuild(environment, fingerprint, builds) {
  const target = getLegacyRuntime(environment, fingerprint);
  if (!target || !Array.isArray(builds)) {
    throw new Error("No verified Production runtime compatibility evidence");
  }
  const matches = builds.filter((build) => build?.id === target.buildId);
  const build = matches[0];
  if (
    matches.length !== 1 ||
    build.status !== "FINISHED" ||
    build.platform !== "ANDROID" ||
    build.runtimeVersion !== target.runtimeVersion ||
    build.fingerprint?.hash !== target.runtimeVersion ||
    build.channel !== "production" ||
    build.buildProfile !== "production" ||
    build.appBuildVersion !== "17" ||
    build.gitCommitHash !== "6d2d6b067a208f2de2c7ffe90ad0fea16a046f9a" ||
    build.project?.id !== "7425b02f-80fe-4ccf-b7fa-c6052282fe35"
  ) {
    throw new Error("The verified Play runtime build is missing or mismatched");
  }
  return build.id;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [action, environment, fingerprint] = process.argv.slice(2);
  if (action === "runtime") {
    process.stdout.write(
      getLegacyRuntime(environment, fingerprint)?.runtimeVersion ?? "",
    );
  } else if (action === "build") {
    process.stdout.write(
      validateLegacyBuild(
        environment,
        fingerprint,
        JSON.parse(readFileSync(0, "utf8")),
      ),
    );
  } else {
    throw new Error("Expected runtime or build compatibility check");
  }
}
