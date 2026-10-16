import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];
const installer = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../scripts/apply-native-patches.mjs",
  ),
  "utf8",
);

function installFixture(
  hoisted: boolean,
  patchExitCode = 0,
  fingerprintHoisted = hoisted,
  fingerprintPatchExitCode = 0,
) {
  const root = mkdtempSync(join(tmpdir(), "gonggu-native-patches-"));
  fixtures.push(root);
  const mobile = join(root, "apps", "mobile");
  const installRoot = hoisted ? root : mobile;
  const modules = join(installRoot, "node_modules");
  mkdirSync(join(mobile, "scripts"), { recursive: true });
  mkdirSync(join(mobile, "patches"));
  mkdirSync(join(mobile, "fingerprint-patches"));
  const fingerprintRoot = join(
    fingerprintHoisted ? root : mobile,
    "node_modules",
    "@expo",
    "fingerprint",
  );
  mkdirSync(fingerprintRoot, { recursive: true });
  writeFileSync(join(fingerprintRoot, "package.json"), "{}");
  mkdirSync(join(modules, "react-native-google-mobile-ads"), {
    recursive: true,
  });
  mkdirSync(join(modules, "patch-package"));
  writeFileSync(join(mobile, "scripts", "apply-native-patches.mjs"), installer);
  writeFileSync(
    join(modules, "react-native-google-mobile-ads", "package.json"),
    "{}",
  );
  writeFileSync(join(mobile, "patches", "expected.patch"), "native-sdk-update");
  writeFileSync(
    join(mobile, "fingerprint-patches", "expected.patch"),
    "fingerprint-normalization",
  );
  writeFileSync(
    join(modules, "patch-package", "index.js"),
    `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const patchDir = args[args.indexOf("--patch-dir") + 1];
if (!args.includes("--error-on-fail")) process.exit(99);
const patch = fs.readFileSync(path.resolve(patchDir, "expected.patch"), "utf8");
const fingerprint = patch === "fingerprint-normalization";
if (!fingerprint && patch !== "native-sdk-update") process.exit(98);
const target = fingerprint ? "@expo/fingerprint" : "react-native-google-mobile-ads";
if (!fs.existsSync(path.resolve("node_modules", target, "package.json"))) process.exit(97);
console.log(fingerprint ? "fingerprint patches found" : "native patches found");
process.exit(fingerprint ? ${fingerprintPatchExitCode} : ${patchExitCode});
`,
  );

  return spawnSync(process.execPath, ["scripts/apply-native-patches.mjs"], {
    cwd: mobile,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    // Only remove the temporary directories created by this test.
    if (dirname(fixture) !== tmpdir())
      throw new Error("Invalid fixture directory");
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe("native patch installation", () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "finds patches with ads hoisting=%s and fingerprint hoisting=%s",
    (hoisted, fingerprintHoisted) => {
      const result = installFixture(hoisted, 0, fingerprintHoisted);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("native patches found");
      expect(result.stdout).toContain("fingerprint patches found");
    },
  );

  it("fails the install when the native patch cannot be applied", () => {
    const result = installFixture(true, 17);
    expect(result.status).toBe(17);
  });

  it("fails the install when fingerprint normalization cannot be applied", () => {
    const result = installFixture(true, 0, false, 18);
    expect(result.status).toBe(18);
  });
});
