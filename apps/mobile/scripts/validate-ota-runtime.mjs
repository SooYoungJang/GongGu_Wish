import { pathToFileURL } from "node:url";

const VALID_RUNTIME_VERSION = /^[A-Za-z0-9_-]{16,128}$/;

export function validateConfig(
  value,
  expectedRuntimeVersion,
  expectedAdMode,
  expectedAdRequestsEnabled,
) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expo config output must be a JSON object");
  }
  if (value.runtimeVersion !== expectedRuntimeVersion) {
    throw new Error("Expo config top-level runtime does not match the build");
  }
  if (
    value.android === null ||
    typeof value.android !== "object" ||
    Array.isArray(value.android) ||
    value.android.runtimeVersion !== expectedRuntimeVersion
  ) {
    throw new Error("Expo config Android runtime does not match the build");
  }
  if (value.extra?.adsMode !== expectedAdMode) {
    throw new Error("Expo config AdMob mode does not match the build");
  }
  if (value.extra?.admobRequestsEnabled !== expectedAdRequestsEnabled) {
    throw new Error(
      "Expo config AdMob request setting does not match the build",
    );
  }
}

export function validateUpdate(value, expectedRuntimeVersion) {
  if (value === null || !Array.isArray(value) || value.length !== 1) {
    throw new Error(
      "EAS Update output must contain exactly one Android update",
    );
  }
  const [update] = value;
  if (update === null || typeof update !== "object" || Array.isArray(update)) {
    throw new Error("EAS Update output contains an invalid update record");
  }
  if (update.platform !== "android") {
    throw new Error("EAS Update output did not contain the Android update");
  }
  if (update.runtimeVersion !== expectedRuntimeVersion) {
    throw new Error("EAS Update runtime does not match the compatible build");
  }
}

function parseJson(input, label) {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`${label} was not valid JSON`);
  }
}

export function validateOtaRuntime(
  mode,
  expectedRuntimeVersion,
  input,
  expectedAdMode,
  expectedAdRequestsEnabled,
) {
  if (!VALID_RUNTIME_VERSION.test(expectedRuntimeVersion ?? "")) {
    throw new Error("Expected runtime version is invalid");
  }
  const value = parseJson(
    input,
    mode === "config" ? "Expo config output" : "EAS Update output",
  );
  if (mode === "config") {
    if (!/^(?:off|test|production)$/.test(expectedAdMode ?? "")) {
      throw new Error("Expected AdMob mode is invalid");
    }
    if (typeof expectedAdRequestsEnabled !== "boolean") {
      throw new Error("Expected AdMob request setting is invalid");
    }
    validateConfig(
      value,
      expectedRuntimeVersion,
      expectedAdMode,
      expectedAdRequestsEnabled,
    );
    return `Verified Android OTA runtime ${expectedRuntimeVersion}`;
  }
  if (mode === "update") {
    validateUpdate(value, expectedRuntimeVersion);
    return `Published Android OTA runtime ${expectedRuntimeVersion}`;
  }
  throw new Error("Validation mode must be config or update");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const input = await new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (value += chunk));
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });
  const expectedAdRequestsEnabled =
    process.argv[5] === "true"
      ? true
      : process.argv[5] === "false"
        ? false
        : undefined;
  const result = validateOtaRuntime(
    process.argv[2],
    process.argv[3],
    input,
    process.argv[4],
    expectedAdRequestsEnabled,
  );
  process.stdout.write(`${result}\n`);
}
