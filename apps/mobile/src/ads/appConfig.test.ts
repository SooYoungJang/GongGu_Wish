import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import createAppConfig from "../../app.config.js";

const {
  GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
  GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
  GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID,
  applyGoogleMobileAdsAndroidManifest,
  applyGoogleMobileAdsIosInfoPlist,
  resolveBackendEnvironment,
  resolveAdsBuildConfig,
  resolveAdRequestsEnabled,
  resolveAdsRuntimeSmoke,
  resolveAppVariant,
  resolveGoogleServicesFile,
  resolveRuntimeVersion,
  validateGoogleServicesFile,
} = createAppConfig;

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

const productionAndroidAppId = "ca-app-pub-1111111111111111~2222222222";
const productionIosAppId = "ca-app-pub-1111111111111111~6666666666";
const productionNativeUnitIds = {
  detail: "ca-app-pub-1111111111111111/3333333333",
  home: "ca-app-pub-1111111111111111/4444444444",
  reels: "ca-app-pub-1111111111111111/5555555555",
};
const previewSupabaseUrl = "https://xwblovggtvbpiusjfokq.supabase.co";
const previewApiProxyUrl = "https://api-preview.gongguwish.com";
const productionSupabaseUrl = "https://iosdoheblabfimkjnvfj.supabase.co";
const productionApiProxyUrl = "https://api.gongguwish.com";

const baseInput = {
  automatedE2E: false,
  configuredAndroidAppId: undefined,
  configuredAndroidNativeUnitIds: {},
  configuredIosAppId: undefined,
  configuredIosNativeUnitIds: {},
  isProductionBuild: true,
  requestedMode: undefined,
  requestedRequestsEnabled: undefined,
};

describe("resolveAdRequestsEnabled", () => {
  it("enables requests only for the exact true value", () => {
    expect(resolveAdRequestsEnabled("true")).toBe(true);
  });

  it.each([undefined, "", "false", "TRUE", "yes", "invalid"])(
    "fails closed for %s",
    (value) => {
      expect(resolveAdRequestsEnabled(value)).toBe(false);
    },
  );
});

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

describe("resolveAdsRuntimeSmoke", () => {
  it("allows the diagnostic ad surface only in Preview", () => {
    expect(resolveAdsRuntimeSmoke("preview", "true")).toBe(true);
    expect(resolveAdsRuntimeSmoke("production", "true")).toBe(false);
    expect(resolveAdsRuntimeSmoke("preview", "false")).toBe(false);
  });
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

describe("validateGoogleServicesFile", () => {
  function writeGoogleServicesFile(packageName: string) {
    const directory = mkdtempSync(join(tmpdir(), "gonggu-firebase-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "google-services.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        project_info: { project_id: "gonggu-test" },
        client: [
          {
            client_info: {
              mobilesdk_app_id: "1:123456789012:android:test",
              android_client_info: { package_name: packageName },
            },
          },
        ],
      }),
    );
    return filePath;
  }

  it.each(["com.gonggu.wish.preview", "com.gonggu.wish"])(
    "accepts a Firebase file for %s",
    (applicationId) => {
      const filePath = writeGoogleServicesFile(applicationId);

      expect(validateGoogleServicesFile(applicationId, filePath, true)).toBe(
        filePath,
      );
    },
  );

  it("rejects a Firebase file for a different package", () => {
    const filePath = writeGoogleServicesFile("com.gonggu.wish");

    expect(() =>
      validateGoogleServicesFile("com.gonggu.wish.preview", filePath, true),
    ).toThrow(/com\.gonggu\.wish\.preview/);
  });

  it("requires an environment file for native release builds", () => {
    expect(() =>
      validateGoogleServicesFile("com.gonggu.wish.preview", undefined, true),
    ).toThrow(/GOOGLE_SERVICES_JSON/);
  });

  it("rejects malformed Firebase JSON", () => {
    const directory = mkdtempSync(join(tmpdir(), "gonggu-firebase-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "google-services.json");
    writeFileSync(filePath, "not-json");

    expect(() =>
      validateGoogleServicesFile("com.gonggu.wish.preview", filePath, true),
    ).toThrow(/readable JSON/);
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

  it("accepts the CI-verified compatible build fingerprint for OTA updates", () => {
    expect(
      resolveRuntimeVersion(
        "  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  ",
      ),
    ).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  });

  it("rejects malformed runtime version overrides", () => {
    expect(() => resolveRuntimeVersion("too-short")).toThrow(
      /runtime version override/i,
    );
  });

  it("applies the OTA runtime to both top-level and Android config", () => {
    const previousEnvironment = {
      GONGGU_OTA_ADMOB_MODE: process.env.GONGGU_OTA_ADMOB_MODE,
      GONGGU_OTA_AD_REQUESTS_ENABLED:
        process.env.GONGGU_OTA_AD_REQUESTS_ENABLED,
      GONGGU_OTA_RUNTIME_VERSION: process.env.GONGGU_OTA_RUNTIME_VERSION,
      EXPO_PUBLIC_ADMOB_MODE: process.env.EXPO_PUBLIC_ADMOB_MODE,
      EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED:
        process.env.EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED,
    };
    const runtime =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.GONGGU_OTA_RUNTIME_VERSION = runtime;
    process.env.GONGGU_OTA_ADMOB_MODE = "test";
    process.env.GONGGU_OTA_AD_REQUESTS_ENABLED = "true";
    process.env.EXPO_PUBLIC_ADMOB_MODE = "production";
    process.env.EXPO_PUBLIC_ADMOB_REQUESTS_ENABLED = "false";

    try {
      const resolved = createAppConfig({
        config: { android: { runtimeVersion: "stale-android-runtime" } },
      });
      expect(resolved.runtimeVersion).toBe(runtime);
      expect(resolved.android?.runtimeVersion).toBe(runtime);
      expect(resolved.extra?.adsMode).toBe("test");
      expect(resolved.extra?.admobRequestsEnabled).toBe(true);
    } finally {
      for (const [name, value] of Object.entries(previousEnvironment)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});

describe("resolveAdsBuildConfig", () => {
  const disabledNativeUnitIds = {
    android: null,
    ios: null,
  };

  it("defaults store-like builds to off with safe sample app IDs", () => {
    expect(resolveAdsBuildConfig(baseInput)).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode: "off",
      requestsEnabled: false,
      nativeUnitIds: disabledNativeUnitIds,
    });
  });

  it("defaults local non-production builds to test mode", () => {
    expect(
      resolveAdsBuildConfig({ ...baseInput, isProductionBuild: false }),
    ).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode: "test",
      requestsEnabled: false,
      nativeUnitIds: disabledNativeUnitIds,
    });
  });

  it("ignores leaked production IDs in test and off modes", () => {
    for (const mode of ["test", "off"]) {
      expect(
        resolveAdsBuildConfig({
          ...baseInput,
          requestedMode: mode,
          configuredAndroidAppId: productionAndroidAppId,
          configuredAndroidNativeUnitIds: productionNativeUnitIds,
          configuredIosAppId: productionIosAppId,
          configuredIosNativeUnitIds: productionNativeUnitIds,
        }),
      ).toMatchObject({
        androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
        iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
        mode,
        nativeUnitIds: disabledNativeUnitIds,
      });
    }
  });

  it("accepts matching production IDs for both platforms", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        configuredAndroidAppId: productionAndroidAppId,
        configuredAndroidNativeUnitIds: productionNativeUnitIds,
        configuredIosAppId: productionIosAppId,
        configuredIosNativeUnitIds: productionNativeUnitIds,
      }),
    ).toEqual({
      androidAppId: productionAndroidAppId,
      iosAppId: productionIosAppId,
      mode: "production",
      requestsEnabled: false,
      nativeUnitIds: {
        android: productionNativeUnitIds,
        ios: productionNativeUnitIds,
      },
    });
  });

  it("allows Android production ads while iOS stays safely disabled", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        configuredAndroidAppId: productionAndroidAppId,
        configuredAndroidNativeUnitIds: productionNativeUnitIds,
      }),
    ).toEqual({
      androidAppId: productionAndroidAppId,
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode: "production",
      requestsEnabled: false,
      nativeUnitIds: {
        android: productionNativeUnitIds,
        ios: null,
      },
    });
  });

  it("validates and embeds production IDs while requests stay off", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        requestedRequestsEnabled: "false",
        configuredAndroidAppId: productionAndroidAppId,
        configuredAndroidNativeUnitIds: productionNativeUnitIds,
      }),
    ).toMatchObject({
      androidAppId: productionAndroidAppId,
      mode: "production",
      requestsEnabled: false,
      nativeUnitIds: { android: productionNativeUnitIds },
    });
  });

  it.each(["home", "reels", "detail"])(
    "rejects a partially configured platform missing %s",
    (placement) => {
      expect(() =>
        resolveAdsBuildConfig({
          ...baseInput,
          requestedMode: "production",
          configuredAndroidAppId: productionAndroidAppId,
          configuredAndroidNativeUnitIds: {
            ...productionNativeUnitIds,
            [placement]: undefined,
          },
        }),
      ).toThrow(/AdMob/);
    },
  );

  it.each([
    ["malformed app ID", "bad-app-id", productionNativeUnitIds],
    ["swapped IDs", productionNativeUnitIds.home, productionNativeUnitIds],
    [
      "different publishers",
      productionAndroidAppId,
      {
        ...productionNativeUnitIds,
        reels: "ca-app-pub-9999999999999999/3333333333",
      },
    ],
    [
      "Google test IDs",
      GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      {
        detail: GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
        home: GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
        reels: GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID,
      },
    ],
  ])("rejects production mode with %s", (_label, appId, unitIds) => {
    expect(() =>
      resolveAdsBuildConfig({
        ...baseInput,
        requestedMode: "production",
        configuredAndroidAppId: appId,
        configuredAndroidNativeUnitIds: unitIds,
      }),
    ).toThrow(/AdMob/);
  });

  it("rejects production mode when neither platform is configured", () => {
    expect(() =>
      resolveAdsBuildConfig({ ...baseInput, requestedMode: "production" }),
    ).toThrow(/AdMob/);
  });

  it("lets E2E override malformed production configuration", () => {
    expect(
      resolveAdsBuildConfig({
        ...baseInput,
        automatedE2E: true,
        requestedMode: "production",
        configuredAndroidAppId: "bad-app-id",
        configuredAndroidNativeUnitIds: { home: "bad-unit-id" },
      }),
    ).toEqual({
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode: "off",
      requestsEnabled: false,
      nativeUnitIds: disabledNativeUnitIds,
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

describe("applyGoogleMobileAdsIosInfoPlist", () => {
  it("writes the iOS app ID and preserves existing SKAdNetwork entries", () => {
    const existingNetworks = [
      { SKAdNetworkIdentifier: "existing.skadnetwork" },
    ];

    expect(
      applyGoogleMobileAdsIosInfoPlist(
        { SKAdNetworkItems: existingNetworks },
        GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      ),
    ).toMatchObject({
      GADApplicationIdentifier: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      SKAdNetworkItems: existingNetworks,
    });
  });

  it("adds Google's SKAdNetwork identifier when none exists", () => {
    expect(
      applyGoogleMobileAdsIosInfoPlist({}, GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID),
    ).toMatchObject({
      SKAdNetworkItems: [{ SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" }],
    });
  });
});
