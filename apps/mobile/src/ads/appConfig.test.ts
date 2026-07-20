import { describe, expect, it } from "vitest";

import createAppConfig from "../../app.config.js";

const {
  GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
  applyGoogleMobileAdsAndroidManifest,
  resolveBackendEnvironment,
  resolveAdsBuildConfig,
  resolveAppVariant,
  resolveGoogleServicesFile,
  resolveRuntimeVersion,
} = createAppConfig;

const productionAndroidAppId = "ca-app-pub-1111111111111111~2222222222";
const productionNativeUnitId = "ca-app-pub-1111111111111111/3333333333";
const previewSupabaseUrl = "https://xwblovggtvbpiusjfokq.supabase.co";
const previewApiProxyUrl = "https://api-preview.gongguwish.com";
const productionSupabaseUrl = "https://iosdoheblabfimkjnvfj.supabase.co";
const productionApiProxyUrl = "https://api.gongguwish.com";

const baseInput = {
  automatedE2E: false,
  configuredAndroidAppId: undefined,
  configuredHomeNativeUnitId: undefined,
  isProductionBuild: true,
  requestedMode: undefined,
};

describe("resolveAppVariant", () => {
  it.each([
    [
      "preview",
      {
        applicationId: "com.gonggu.wish.preview",
        name: "공구위시 Preview",
        scheme: "gongguwish-preview",
      },
    ],
    [
      "production",
      {
        applicationId: "com.gonggu.wish",
        name: "공구위시",
        scheme: "gongguwish",
      },
    ],
  ])("resolves the %s app identity", (variant, expected) => {
    expect(resolveAppVariant(variant)).toEqual({ key: variant, ...expected });
  });

  it("uses Preview when APP_VARIANT is absent or blank", () => {
    expect(resolveAppVariant(undefined).key).toBe("preview");
    expect(resolveAppVariant("  ").key).toBe("preview");
  });

  it.each(["development", "staging", "unknown"])(
    "rejects the legacy or unknown %s variant",
    (variant) => {
      expect(() => resolveAppVariant(variant)).toThrow(/APP_VARIANT/);
    },
  );
});

describe("resolveGoogleServicesFile", () => {
  it("uses an environment-scoped Firebase file when configured", () => {
    expect(
      resolveGoogleServicesFile(
        "preview",
        " C:/eas/google-services-preview.json ",
        "./google-services.json",
      ),
    ).toBe("C:/eas/google-services-preview.json");
  });

  it("keeps the existing Firebase file only for Production", () => {
    expect(
      resolveGoogleServicesFile(
        "production",
        undefined,
        "./google-services.json",
      ),
    ).toBe("./google-services.json");
    expect(
      resolveGoogleServicesFile("preview", undefined, "./google-services.json"),
    ).toBeUndefined();
  });
});

describe("resolveBackendEnvironment", () => {
  it("accepts only the preview backend for Preview", () => {
    expect(
      resolveBackendEnvironment({
        apiProxyUrl: `${previewApiProxyUrl}/`,
        anonKey: "preview-anon-key",
        supabaseUrl: `${previewSupabaseUrl}/`,
        variant: "preview",
      }),
    ).toEqual({
      apiProxyUrl: previewApiProxyUrl,
      supabaseUrl: previewSupabaseUrl,
    });
  });

  it("accepts only the Production backend for Production", () => {
    expect(
      resolveBackendEnvironment({
        apiProxyUrl: productionApiProxyUrl,
        anonKey: "production-anon-key",
        supabaseUrl: productionSupabaseUrl,
        variant: "production",
      }),
    ).toEqual({
      apiProxyUrl: productionApiProxyUrl,
      supabaseUrl: productionSupabaseUrl,
    });
  });

  it("rejects Preview paired with Production data", () => {
    expect(() =>
      resolveBackendEnvironment({
        apiProxyUrl: productionApiProxyUrl,
        anonKey: "production-anon-key",
        supabaseUrl: productionSupabaseUrl,
        variant: "preview",
      }),
    ).toThrow(/preview.*preview backend/i);
  });

  it("rejects Production paired with preview data", () => {
    expect(() =>
      resolveBackendEnvironment({
        apiProxyUrl: previewApiProxyUrl,
        anonKey: "preview-anon-key",
        supabaseUrl: previewSupabaseUrl,
        variant: "production",
      }),
    ).toThrow(/production.*production backend/i);
  });

  it.each([
    ["Supabase URL", undefined, previewApiProxyUrl, "preview-anon-key"],
    ["API proxy URL", previewSupabaseUrl, undefined, "preview-anon-key"],
    ["Supabase anon key", previewSupabaseUrl, previewApiProxyUrl, undefined],
  ])("rejects a missing %s", (_label, supabaseUrl, apiProxyUrl, anonKey) => {
    expect(() =>
      resolveBackendEnvironment({
        apiProxyUrl,
        anonKey,
        supabaseUrl,
        variant: "preview",
      }),
    ).toThrow(/required/i);
  });
});

describe("resolveRuntimeVersion", () => {
  it("uses Expo Fingerprint for native compatibility", () => {
    expect(resolveRuntimeVersion()).toEqual({ policy: "fingerprint" });
  });
});

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
