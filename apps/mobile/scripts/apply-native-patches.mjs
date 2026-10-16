import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patches = [
  { packageName: "react-native-google-mobile-ads", directory: "patches" },
  // Backport Expo's Windows path normalization without changing native inputs.
  // https://github.com/expo/expo/pull/46816 (and its ExpoConfigLoader fix #47666)
  { packageName: "@expo/fingerprint", directory: "fingerprint-patches" },
];

for (const { packageName, directory } of patches) {
  // npm can hoist each dependency independently, including scoped packages.
  const packageRoot = dirname(require.resolve(`${packageName}/package.json`));
  const installRoot = resolve(
    packageRoot,
    packageName.startsWith("@") ? "../../.." : "../..",
  );
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("patch-package/index.js"),
      "--patch-dir",
      relative(installRoot, resolve(mobileRoot, directory)),
      "--error-on-fail",
    ],
    { cwd: installRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
