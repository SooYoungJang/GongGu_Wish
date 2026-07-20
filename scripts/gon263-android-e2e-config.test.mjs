import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const require = createRequire(import.meta.url);

test("Android E2E verifies localhost origins through the app journeys", () => {
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");
  const seed = read("supabase/seed.sql");
  const builder = read("scripts/build-gon263-android-e2e.sh");
  const codegen = read("scripts/generate-gon263-android-codegen.mjs");
  const runner = read("scripts/run-gon263-android-e2e.sh");
  const activeFlows = [
    ".maestro/gon-263-critical-journeys.yaml",
    ".maestro/gon-263-reels-lifecycle.yaml",
    ".maestro/gon-264-android-accessibility.yaml",
    ".maestro/gon-229-notification-preferences.yaml",
    ".maestro/gon-229-notification-tap.yaml",
  ];

  assert.match(workflow, /APP_VARIANT: "staging"/);
  for (const flowPath of activeFlows) {
    assert.match(read(flowPath), /^appId: com\.gonggu\.wish\.preview$/m);
  }
  assert.match(workflow, /EXPO_PUBLIC_SUPABASE_URL=http:\/\/localhost:54321/);
  assert.doesNotMatch(seed, /127\.0\.0\.1:58080/);
  assert.match(seed, /http:\/\/localhost:58080\/media\/fixture\.mp4/);
  assert.match(runner, /adb-reverse-after-install\.txt/);
  assert.match(builder, /-Dorg\.gradle\.jvmargs=\"-Xmx4096m/);
  assert.match(builder, /-Dorg\.gradle\.parallel=false/);
  assert.match(builder, /-Dorg\.gradle\.workers\.max=2/);
  assert.match(builder, /-PnewArchEnabled=true/);
  assert.match(builder, /generate-gon263-android-codegen\.mjs/);
  assert.match(codegen, /target_compile_reactnative_options/);
  assert.match(codegen, /const libraryType = "all"/);
  assert.match(builder, /:app:generateCodegenArtifactsFromSchema/);
  assert.match(workflow, /unzip -Z1 "\$android_apk"/);
  assert.match(workflow, /lib\/x86_64\/.*\\\.so/);
  assert.doesNotMatch(workflow, /Android E2E compiled an unused ABI/);
  assert.match(
    runner,
    /maestro test \.maestro\/gon-263-critical-journeys\.yaml/,
  );
  assert.doesNotMatch(runner, /toybox nc/);
  assert.doesNotMatch(workflow, /device-(supabase|media)-probe\.txt/);
});

test("canonical detail checks scroll the exact seeded price into view", () => {
  const flow = read(".maestro/gon-263-critical-journeys.yaml");
  const priceCheck = `- scrollUntilVisible:
    element:
      text: "가격 200,000원"
    direction: DOWN
    timeout: 30000
- assertVisible:
    text: "가격 200,000원"`;

  assert.equal(flow.split(priceCheck).length - 1, 2);
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
  const environmentKeys = [
    "APP_VARIANT",
    "EXPO_PUBLIC_API_PROXY_URL",
    "EXPO_PUBLIC_E2E_MODE",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_URL",
  ];
  const previousEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );

  try {
    process.env.APP_VARIANT = "production";
    process.env.EXPO_PUBLIC_API_PROXY_URL = "https://api.gongguwish.com";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "production-config-test";
    process.env.EXPO_PUBLIC_SUPABASE_URL =
      "https://iosdoheblabfimkjnvfj.supabase.co";
    delete process.env.EXPO_PUBLIC_E2E_MODE;
    const productionConfig = appConfig({
      config: { android: {}, version: "0.1.0" },
    });
    assert.equal(productionConfig.android.usesCleartextTraffic, undefined);
    assert.equal(typeof productionConfig.mods.android.manifest, "function");

    const adsManifest = {
      manifest: {
        $: {},
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    };
    const adsResult = appConfig.applyGoogleMobileAdsAndroidManifest(
      adsManifest,
      appConfig.GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
    );
    assert.equal(
      adsResult.manifest.application[0].$["android:usesCleartextTraffic"],
      undefined,
    );

    process.env.EXPO_PUBLIC_E2E_MODE = "true";
    const e2eConfig = appConfig({
      config: { android: {}, version: "0.1.0" },
    });
    assert.equal(typeof e2eConfig.mods.android.manifest, "function");
  } finally {
    for (const key of environmentKeys) {
      const previousValue = previousEnvironment[key];
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
});

test("GON-264 Android E2E exercises large text and the accessibility tree", () => {
  const workflow = read(".github/workflows/mobile-ios-e2e.yml");
  const orchestrator = read("scripts/run-gon263-android-e2e.sh");
  const accessibilityRunner = read(
    "scripts/run-gon264-android-accessibility.sh",
  );
  const flow = read(".maestro/gon-264-android-accessibility.yaml");

  assert.match(
    orchestrator,
    /bash scripts\/run-gon264-android-accessibility\.sh/,
  );
  assert.match(accessibilityRunner, /settings put system font_scale 2\.0/);
  assert.match(accessibilityRunner, /cmd uimode night yes/);
  assert.match(accessibilityRunner, /force-stop com\.gonggu\.wish\.preview/);
  assert.match(
    accessibilityRunner,
    /maestro test \.maestro\/gon-264-android-accessibility\.yaml/,
  );
  assert.match(accessibilityRunner, /uiautomator dump/);
  assert.match(accessibilityRunner, /gon264-reels-accessibility\.xml/);
  assert.match(accessibilityRunner, /content-desc="홈 탭"/);
  assert.match(accessibilityRunner, /content-desc="릴스 탭"/);
  assert.match(accessibilityRunner, /test "\$\{home_tab_count[^\n]*\}" -eq 0/);
  assert.match(accessibilityRunner, /test "\$\{reels_tab_count[^\n]*\}" -eq 0/);

  assert.match(flow, /GON-263 기준 공구, 가격 200,000원, 판매자/);
  assert.match(flow, /id: "calendar-picker-modal"/);
  assert.match(flow, /id: "ranking-top-hero"/);
  assert.match(flow, /text: "릴스 탭"/);
  assert.match(flow, /text: "요약 닫기"/);
  assert.match(flow, /assertNotVisible:\n\s+text: "홈 탭"/);
  assert.match(flow, /assertNotVisible:\n\s+text: "릴스 탭"/);

  const afterDealCard = flow.slice(
    flow.indexOf("takeScreenshot: gon264-android-02-deal-card-label"),
    flow.indexOf('text: "랭킹 탭"'),
  );
  assert.doesNotMatch(afterDealCard, /상품을 검색해보세요/);

  assert.match(workflow, /gon264-output\.log/);
  assert.match(workflow, /gon264-reels-accessibility\.xml/);
  assert.match(workflow, /gon264-android-\*\.png/);
});
