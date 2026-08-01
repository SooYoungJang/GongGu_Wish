import assert from "node:assert/strict";
import test from "node:test";

import { resolveHermescPath } from "./resolve-hermesc-path.mjs";

const packageJsonPath = "/workspace/node_modules/hermes-compiler/package.json";

test("resolves the Linux Hermes disassembler", () => {
  assert.match(
    resolveHermescPath({ platform: "linux", packageJsonPath }).replaceAll(
      "\\",
      "/",
    ),
    /hermes-compiler\/hermesc\/linux64-bin\/hermesc$/,
  );
});

test("resolves the Windows Hermes disassembler", () => {
  const resolved = resolveHermescPath({
    platform: "win32",
    packageJsonPath:
      "C:\\workspace\\node_modules\\hermes-compiler\\package.json",
  });

  assert.match(
    resolved.replaceAll("\\", "/"),
    /hermes-compiler\/hermesc\/win64-bin\/hermesc\.exe$/,
  );
});

test("rejects unsupported Hermes compiler platforms", () => {
  assert.throws(
    () => resolveHermescPath({ platform: "aix", packageJsonPath }),
    /Unsupported Hermes compiler platform: aix/,
  );
});
