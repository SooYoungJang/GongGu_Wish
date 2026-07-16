import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const require = createRequire(import.meta.url);

test("Android E2E uses verified adb-reversed localhost origins", () => {
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");
  const seed = read("supabase/seed.sql");
  const runner = read("scripts/run-gon263-android-e2e.sh");

  assert.match(workflow, /EXPO_PUBLIC_SUPABASE_URL=http:\/\/localhost:54321/);
  assert.doesNotMatch(seed, /127\.0\.0\.1:58080/);
  assert.match(seed, /http:\/\/localhost:58080\/media\/fixture\.mp4/);
  assert.match(runner, /adb-reverse-after-install\.txt/);
  assert.match(runner, /device-supabase-probe\.txt/);
  assert.match(runner, /device-media-probe\.txt/);
  assert.match(runner, /toybox nc/);
});

test("Android E2E config plugin enables cleartext only in generated manifest", () => {
  const appConfig = require("../apps/mobile/app.config.js");
  const manifest = { manifest: { application: [{ $: {} }] } };

  const result = appConfig.applyAutomatedE2EAndroidManifest(manifest);

  assert.equal(
    result.manifest.application[0].$["android:usesCleartextTraffic"],
    "true",
  );
});

test("production app config keeps Android cleartext disabled", () => {
  const appConfig = require("../apps/mobile/app.config.js");
  const previousMode = process.env.EXPO_PUBLIC_E2E_MODE;

  try {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
    const productionConfig = appConfig({ config: { android: {} } });
    assert.equal(productionConfig.android.usesCleartextTraffic, undefined);
    assert.equal(productionConfig.mods, undefined);

    process.env.EXPO_PUBLIC_E2E_MODE = "true";
    const e2eConfig = appConfig({ config: { android: {} } });
    assert.equal(typeof e2eConfig.mods.android.manifest, "function");
  } finally {
    if (previousMode === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    } else {
      process.env.EXPO_PUBLIC_E2E_MODE = previousMode;
    }
  }
});
