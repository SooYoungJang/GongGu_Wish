import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const mobilePackage = JSON.parse(
  readFileSync(join(mobileRoot, "package.json"), "utf8"),
);
const reactNativeRoot = dirname(require.resolve("react-native/package.json"));
const codegenRoot = dirname(require.resolve("@react-native/codegen/package.json"));
const combineSchemaCli = join(
  codegenRoot,
  "lib",
  "cli",
  "combine",
  "combine-js-to-schema-cli.js",
);
const generateSpecsCli = join(reactNativeRoot, "scripts", "generate-specs-cli.js");

function resolvePackageJson(packageName) {
  try {
    return require.resolve(`${packageName}/package.json`, {
      paths: [mobileRoot, repoRoot],
    });
  } catch {
    const candidates = [
      join(mobileRoot, "node_modules", packageName, "package.json"),
      join(repoRoot, "node_modules", packageName, "package.json"),
    ];
    return candidates.find((candidate) => existsSync(candidate));
  }
}

function runNode(script, args, packageName) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`[GON-263] ${packageName} codegen failed: ${result.error}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `[GON-263] ${packageName} codegen exited with status ${result.status}`,
    );
  }
}

function generatePackageCodegen(packageName) {
  if (packageName === "react-native") {
    return;
  }

  const packageJsonPath = resolvePackageJson(packageName);
  if (!packageJsonPath) {
    return;
  }

  const packageRoot = dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const codegenConfig = packageJson.codegenConfig;
  const androidConfig = codegenConfig?.android;
  if (
    !androidConfig ||
    !codegenConfig.jsSrcsDir ||
    codegenConfig.includesGeneratedCode
  ) {
    return;
  }

  const outputDir = join(
    packageRoot,
    "android",
    "build",
    "generated",
    "source",
    "codegen",
  );
  const generatedCmake = join(outputDir, "jni", "CMakeLists.txt");
  if (existsSync(generatedCmake)) {
    return;
  }

  const jsSourceDir = resolve(packageRoot, codegenConfig.jsSrcsDir);
  if (!existsSync(jsSourceDir)) {
    throw new Error(
      `[GON-263] ${packageName} codegen source directory is missing: ${jsSourceDir}`,
    );
  }

  mkdirSync(outputDir, { recursive: true });
  const schemaPath = join(outputDir, "schema.json");
  const libraryName = codegenConfig.name ?? packageJson.name;
  const libraryType = codegenConfig.type ?? "all";
  const javaPackageName =
    androidConfig.javaPackageName ?? "com.facebook.fbreact.specs";

  console.log(`[GON-263] Generating Android codegen for ${packageName}`);
  runNode(
    combineSchemaCli,
    [
      "--platform",
      "android",
      "--exclude",
      "NativeSampleTurboModule",
      schemaPath,
      jsSourceDir,
    ],
    packageName,
  );
  runNode(
    generateSpecsCli,
    [
      "--platform",
      "android",
      "--schemaPath",
      schemaPath,
      "--outputDir",
      outputDir,
      "--libraryName",
      libraryName,
      "--javaPackageName",
      javaPackageName,
      "--libraryType",
      libraryType,
    ],
    packageName,
  );
}

const dependencies = {
  ...mobilePackage.dependencies,
  ...mobilePackage.devDependencies,
};

for (const packageName of Object.keys(dependencies)) {
  generatePackageCodegen(packageName);
}
