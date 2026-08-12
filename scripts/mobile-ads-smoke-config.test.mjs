import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

test("Android ads smoke requires visible Preview test ads to load", () => {
  const app = read("apps/mobile/src/App.tsx");
  const appConfig = read("apps/mobile/app.config.js");
  const builder = read("scripts/build-mobile-ads-smoke.sh");
  const probe = read("apps/mobile/src/ads/AdsRuntimeSmokeProbe.tsx");
  const runner = read("scripts/run-mobile-ads-smoke.sh");
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");

  assert.match(workflow, /ads_runtime_smoke:[\s\S]*?type: boolean/);
  assert.match(
    workflow,
    /ads-runtime-android:[\s\S]*?github\.event_name == 'pull_request'[\s\S]*?needs\.mobile-e2e-plan\.outputs\.affected == 'true'/,
  );
  assert.match(workflow, /EXPO_PUBLIC_ADS_RUNTIME_SMOKE: "true"/);
  assert.match(workflow, /EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED: "true"/);
  assert.match(workflow, /EXPO_PUBLIC_E2E_MODE: "false"/);
  assert.match(workflow, /build-mobile-ads-smoke\.sh/);
  assert.match(workflow, /run-mobile-ads-smoke\.sh/);
  assert.match(
    workflow,
    /ads-runtime-android:[\s\S]*?ADS_GMS_WARMUP_SECONDS: "180"/,
  );
  assert.match(workflow, /api-level: 36/);
  assert.match(workflow, /target: google_apis_playstore/);
  assert.match(appConfig, /appVariant === "preview"/);
  assert.match(app, /<AdsRuntimeSmokeProbe \/>/);
  assert.ok(
    app.indexOf("<ThemeProvider>") < app.indexOf("<AdsRuntimeSmokeProbe />") &&
      app.indexOf("<AdsRuntimeSmokeProbe />") < app.indexOf("</ThemeProvider>"),
    "the ads smoke probe must render inside ThemeProvider",
  );
  assert.match(builder, /app:assembleRelease/);
  assert.match(builder, /ca-app-pub-3940256099942544~3347511713/);
  assert.match(probe, /placement="home"/);
  assert.match(probe, /placement="reels"/);
  assert.match(runner, /com\.gonggu\.wish\.preview/);
  assert.match(runner, /ADS_GMS_WARMUP_SECONDS/);
  assert.match(runner, /gms-state-before-warmup\.txt/);
  assert.match(runner, /gms-state-after-warmup\.txt/);
  assert.match(runner, /for launch_attempt in \$\(seq 1 30\)/);
  assert.match(runner, /만 14세 이상입니다/);
  assert.match(runner, /input tap/);
  assert.ok(
    runner.includes(
      `sed -nE 's/^bounds="\\[([0-9]+),([0-9]+)\\]\\[([0-9]+),([0-9]+)\\]"$/\\1 \\2 \\3 \\4/p'`,
    ),
  );
  assert.doesNotMatch(runner, /\[\[ ! "\$bounds" =~/);
  assert.match(runner, /\[\[ -z "\$coordinates" \]\]/);
  assert.match(runner, /left >= right \|\| top >= bottom/);
  assert.match(runner, /"event":"initialization_ready"/);
  assert.match(runner, /native_ad_request_started/);
  assert.match(runner, /native_ad_loaded/);
  assert.doesNotMatch(runner, /has_terminal_event/);
  assert.doesNotMatch(runner, /has_no_fill_failure/);
  assert.doesNotMatch(runner, /external_no_fill/);
  assert.doesNotMatch(runner, /Ad failed to load : 3/);
  assert.match(runner, /ads-runtime-result\.json/);
  assert.match(workflow, /ads-runtime-result\.json/);
  assert.match(workflow, /"event":"native_ad_loaded","placement":"home"/);
  assert.match(workflow, /"event":"native_ad_loaded","placement":"reels"/);
  assert.doesNotMatch(workflow, /native_ad_\(loaded\|failed\)/);
  assert.match(runner, /ads-runtime-smoke\.png/);
  assert.doesNotMatch(builder, /com\.gonggu\.wish(?!\.preview)/);
});
