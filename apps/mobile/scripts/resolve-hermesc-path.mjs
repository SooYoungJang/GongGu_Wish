import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

function resolveHermesCompilerPackageJson() {
  const reactNativePackageJson = require.resolve("react-native/package.json");
  return createRequire(reactNativePackageJson).resolve(
    "hermes-compiler/package.json",
  );
}

export function resolveHermescPath({
  platform = process.platform,
  packageJsonPath = resolveHermesCompilerPackageJson(),
} = {}) {
  const platformDirectory = {
    darwin: "osx-bin",
    linux: "linux64-bin",
    win32: "win64-bin",
  }[platform];

  if (!platformDirectory) {
    throw new Error(`Unsupported Hermes compiler platform: ${platform}`);
  }

  return join(
    dirname(packageJsonPath),
    "hermesc",
    platformDirectory,
    platform === "win32" ? "hermesc.exe" : "hermesc",
  );
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  process.stdout.write(resolveHermescPath());
}
