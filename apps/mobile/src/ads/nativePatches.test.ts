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

function installFixture(hoisted: boolean, patchExitCode = 0) {
  const root = mkdtempSync(join(tmpdir(), "gonggu-native-patches-"));
  fixtures.push(root);
  const mobile = join(root, "apps", "mobile");
  const installRoot = hoisted ? root : mobile;
  const modules = join(installRoot, "node_modules");
  mkdirSync(join(mobile, "scripts"), { recursive: true });
  mkdirSync(join(mobile, "patches"));
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
    join(modules, "patch-package", "index.js"),
    `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const patchDir = args[args.indexOf("--patch-dir") + 1];
if (!args.includes("--error-on-fail")) process.exit(99);
const patch = fs.readFileSync(path.resolve(patchDir, "expected.patch"), "utf8");
if (patch !== "native-sdk-update") process.exit(98);
console.log("native patches found");
process.exit(${patchExitCode});
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
  it.each([false, true])(
    "finds patches with dependency hoisting=%s",
    (hoisted) => {
      const result = installFixture(hoisted);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("native patches found");
    },
  );

  it("fails the install when the native patch cannot be applied", () => {
    const result = installFixture(true, 17);
    expect(result.status).toBe(17);
  });
});
