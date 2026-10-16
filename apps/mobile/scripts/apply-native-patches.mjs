import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// npm may hoist the dependency to the monorepo or keep it in this workspace.
const packageRoot = dirname(
  require.resolve("react-native-google-mobile-ads/package.json"),
);
const installRoot = resolve(packageRoot, "../..");
const result = spawnSync(
  process.execPath,
  [
    require.resolve("patch-package/index.js"),
    "--patch-dir",
    relative(installRoot, resolve(mobileRoot, "patches")),
    "--error-on-fail",
  ],
  { cwd: installRoot, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
