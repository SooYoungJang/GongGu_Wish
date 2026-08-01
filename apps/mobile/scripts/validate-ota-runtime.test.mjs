import assert from "node:assert/strict";
import test from "node:test";

import { validateOtaRuntime } from "./validate-ota-runtime.mjs";

const runtime =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("accepts an Expo config whose top-level and Android runtimes match", () => {
  assert.match(
    validateOtaRuntime(
      "config",
      runtime,
      JSON.stringify({
        android: { runtimeVersion: runtime },
        extra: { admobRequestsEnabled: true, adsMode: "test" },
        runtimeVersion: runtime,
      }),
      "test",
      true,
    ),
    /Verified Android OTA runtime/,
  );
});

test("rejects malformed and mismatched Expo config output", () => {
  assert.throws(
    () => validateOtaRuntime("config", runtime, "{", "test", true),
    /valid JSON/,
  );
  assert.throws(
    () =>
      validateOtaRuntime(
        "config",
        runtime,
        JSON.stringify({
          android: { runtimeVersion: runtime },
          extra: { admobRequestsEnabled: true, adsMode: "test" },
          runtimeVersion: "different-runtime-version",
        }),
        "test",
        true,
      ),
    /top-level runtime/,
  );
  assert.throws(
    () =>
      validateOtaRuntime(
        "config",
        runtime,
        JSON.stringify({
          android: { runtimeVersion: "different-runtime-version" },
          extra: { admobRequestsEnabled: true, adsMode: "test" },
          runtimeVersion: runtime,
        }),
        "test",
        true,
      ),
    /Android runtime/,
  );
  assert.throws(
    () =>
      validateOtaRuntime(
        "config",
        runtime,
        JSON.stringify({
          android: { runtimeVersion: runtime },
          extra: { admobRequestsEnabled: true, adsMode: "production" },
          runtimeVersion: runtime,
        }),
        "test",
        true,
      ),
    /AdMob mode/,
  );
  assert.throws(
    () =>
      validateOtaRuntime(
        "config",
        runtime,
        JSON.stringify({
          android: { runtimeVersion: runtime },
          extra: { admobRequestsEnabled: false, adsMode: "test" },
          runtimeVersion: runtime,
        }),
        "test",
        true,
      ),
    /AdMob request setting/,
  );
});

test("accepts exactly one matching Android EAS Update record", () => {
  assert.match(
    validateOtaRuntime(
      "update",
      runtime,
      JSON.stringify([{ platform: "android", runtimeVersion: runtime }]),
    ),
    /Published Android OTA runtime/,
  );
});

test("rejects malformed, empty, iOS-only, duplicate, and mismatched update output", () => {
  const invalidValues = [
    "{",
    "[]",
    JSON.stringify([{ platform: "ios", runtimeVersion: runtime }]),
    JSON.stringify([
      { platform: "android", runtimeVersion: runtime },
      { platform: "android", runtimeVersion: runtime },
    ]),
    JSON.stringify([
      { platform: "android", runtimeVersion: "different-runtime-version" },
    ]),
  ];

  for (const value of invalidValues) {
    assert.throws(() => validateOtaRuntime("update", runtime, value));
  }
});
