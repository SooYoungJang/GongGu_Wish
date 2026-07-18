import { describe, expect, it } from "vitest";

import createAppConfig from "../../app.config.js";

const {
  GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
  applyGoogleMobileAdsAndroidManifest,
  resolveAdsBuildConfig,
} = createAppConfig;

const productionAndroidAppId = "ca-app-pub-1111111111111111~2222222222";
const productionNativeUnitId = "ca-app-pub-1111111111111111/3333333333";

const baseInput = {
  automatedE2E: false,
  configuredAndroidAppId: undefined,
  configuredHomeNativeUnitId: undefined,
  isProductionBuild: true,
  requestedMode: undefined,
};

describe("resolveAdsBuildConfig", () => {
  it("defaults store-like builds to off with the Google test app ID", () => {
    expect(resolveAdsBuildConfig(baseInput)).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      homeNativeUnitId: null,
      mode: "off",
    });
  });

  it("defaults local non-production builds to test mode", () => {
    expect(
      resolveAdsBuildConfig({ ...baseInput, isProductionBuild: false }),
    ).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      homeNativeUnitId: null,
      mode: "test",
    });
  });

  it("ignores leaked production IDs in test and off modes", () => {
    for (const mode of ["test", "off"]) {
      expect(
        resolveAdsBuildConfig({
          ...baseInput,
          requestedMode: mode,
          configuredAndroidAppId: productionAndroidAppId,
          configuredHomeNativeUnitId: productionNativeUnitId,
        }),
      ).toMatchObject({
        androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
        homeNativeUnitId: null,
        mode,
      });
    }
  });

  it("accepts matching production app and native unit IDs", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        configuredAndroidAppId: productionAndroidAppId,
        configuredHomeNativeUnitId: productionNativeUnitId,
      }),
    ).toEqual({
      androidAppId: productionAndroidAppId,
      homeNativeUnitId: productionNativeUnitId,
      mode: "production",
    });
  });

  it.each([
    ["missing IDs", undefined, undefined],
    ["blank IDs", "  ", "  "],
    ["malformed IDs", "bad-app-id", "bad-unit-id"],
    ["swapped IDs", productionNativeUnitId, productionAndroidAppId],
    [
      "different publishers",
      productionAndroidAppId,
      "ca-app-pub-9999999999999999/3333333333",
    ],
    [
      "Google test IDs",
      GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
    ],
  ])("rejects production mode with %s", (_label, appId, unitId) => {
    expect(() =>
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        configuredAndroidAppId: appId,
        configuredHomeNativeUnitId: unitId,
      }),
    ).toThrow(/AdMob/);
  });

  it("lets E2E override malformed production configuration", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        automatedE2E: true,
        requestedMode: "production",
        configuredAndroidAppId: "bad-app-id",
        configuredHomeNativeUnitId: "bad-unit-id",
      }),
    ).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      homeNativeUnitId: null,
      mode: "off",
    });
  });

  it("rejects unknown explicit modes", () => {
    expect(() =>
      resolveAdsBuildConfig({ ...baseInput, requestedMode: "preview" }),
    ).toThrow(/EXPO_PUBLIC_ADMOB_MODE/);
  });
});

describe("applyGoogleMobileAdsAndroidManifest", () => {
  it("writes the app ID and consent-first initialization flags", () => {
    const manifest = {
      manifest: {
        $: {},
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    };

    const result = applyGoogleMobileAdsAndroidManifest(
      manifest,
      GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
    );
    const metadata = Object.fromEntries(
      result.manifest.application[0]["meta-data"].map(
        (item: { $: Record<string, string> }) => [
          item.$["android:name"],
          item.$["android:value"],
        ],
      ),
    );

    expect(metadata).toMatchObject({
      "com.google.android.gms.ads.APPLICATION_ID":
        GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      "com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT": "true",
      "com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION": "true",
      "com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING": "true",
    });
  });
});
