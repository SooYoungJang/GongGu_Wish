import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getLegacyRuntime,
  validateLegacyBuild,
} from "./production-runtime-compatibility.mjs";

const current = "0b37911db44a8039b54b904a2a76843a46733511";
const legacy = "03cb2d49ed9bcaa616a8d38f969acfb7511c6101";
const buildId = "0efa1ce7-b2bc-4f40-852b-365302f1d38a";
const build = () => ({
  id: buildId,
  status: "FINISHED",
  platform: "ANDROID",
  distribution: "STORE",
  runtimeVersion: legacy,
  fingerprint: { hash: legacy },
  channel: "production",
  buildProfile: "production",
  appBuildVersion: "17",
  gitCommitHash: "6d2d6b067a208f2de2c7ffe90ad0fea16a046f9a",
  project: { id: "7425b02f-80fe-4ccf-b7fa-c6052282fe35" },
});

test("only the proven production fingerprint adds the Play runtime", () => {
  const target = getLegacyRuntime("production", current);
  assert.equal(target.runtimeVersion, legacy);
  assert.equal(target.buildId, buildId);
  assert.equal(getLegacyRuntime("preview", current), undefined);
  assert.equal(getLegacyRuntime("production", legacy), undefined);
  assert.equal(getLegacyRuntime("production", `${current}0`), undefined);
  assert.equal(getLegacyRuntime("production", "new-native-code"), undefined);
});

test("requires the exact finished Play build before any legacy publish", () => {
  assert.equal(validateLegacyBuild("production", current, [build()]), buildId);
});

test("rejects absent, duplicate, or malformed build evidence", () => {
  for (const builds of [[], null, {}, [build(), build()]]) {
    assert.throws(() => validateLegacyBuild("production", current, builds));
  }
});

for (const [field, value] of [
  ["id", "other-build-id"],
  ["status", "CANCELED"],
  ["platform", "IOS"],
  ["distribution", "INTERNAL"],
  ["runtimeVersion", current],
  ["fingerprint", { hash: current }],
  ["channel", "preview"],
  ["buildProfile", "production-apk"],
  ["appBuildVersion", "18"],
  ["gitCommitHash", "different-source-commit"],
  ["project", { id: "other-project" }],
]) {
  test(`rejects a mismatched legacy build ${field}`, () => {
    assert.throws(() =>
      validateLegacyBuild("production", current, [
        { ...build(), [field]: value },
      ]),
    );
  });
}

test("cannot validate a legacy publish for Preview or changed native inputs", () => {
  assert.throws(() => validateLegacyBuild("preview", current, [build()]));
  assert.throws(() =>
    validateLegacyBuild("production", "new-native-code", [build()]),
  );
});

const play27Current = "1b5ad6e516176759a885f07c171d490a8500f074";
const play27Runtime = "493502c5bf2457a3740b4d59271cf40645e3e43e";
const play27BuildId = "e14c01a1-3d6e-4d41-844f-99208caab24d";
const play27Build = () => ({
  ...build(),
  id: play27BuildId,
  distribution: "STORE",
  runtimeVersion: play27Runtime,
  fingerprint: { hash: play27Runtime },
  appBuildVersion: "27",
  gitCommitHash: "38e4c52481261bef1fdcfea6d9e454a88912fd34",
});

test("the current CI runtime also reaches the verified Play 27 binary", () => {
  const target = getLegacyRuntime("production", play27Current);
  assert.equal(target?.runtimeVersion, play27Runtime);
  assert.equal(target?.buildId, play27BuildId);
  assert.equal(
    validateLegacyBuild("production", play27Current, [play27Build()]),
    play27BuildId,
  );
});

test("Play 27 equivalence never applies to Preview or changed native inputs", () => {
  for (const [environment, fingerprint] of [
    ["preview", play27Current],
    ["production", play27Runtime],
    ["production", `${play27Current}0`],
  ]) {
    assert.equal(getLegacyRuntime(environment, fingerprint), undefined);
    assert.throws(() =>
      validateLegacyBuild(environment, fingerprint, [play27Build()]),
    );
  }
});

for (const [field, value] of [
  ["id", buildId],
  ["status", "CANCELED"],
  ["platform", "IOS"],
  ["distribution", "INTERNAL"],
  ["runtimeVersion", play27Current],
  ["fingerprint", { hash: play27Current }],
  ["channel", "preview"],
  ["buildProfile", "production-apk"],
  ["appBuildVersion", "28"],
  ["gitCommitHash", "different-source-commit"],
  ["project", { id: "other-project" }],
]) {
  test(`rejects mismatched Play 27 build ${field}`, () => {
    assert.throws(() =>
      validateLegacyBuild("production", play27Current, [
        { ...play27Build(), [field]: value },
      ]),
    );
  });
}

test("Play 27 requires one exact Store build before publishing", () => {
  for (const builds of [[], null, {}, [play27Build(), play27Build()]]) {
    assert.throws(() =>
      validateLegacyBuild("production", play27Current, builds),
    );
  }
});
