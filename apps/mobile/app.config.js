const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID =
  "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID =
  "ca-app-pub-3940256099942544/2247696110";
const ADS_MODES = new Set(["off", "test", "production"]);
const ADMOB_APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const ADMOB_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;

function normalizeValue(value) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function publisherPrefix(id) {
  return id.split(/[~/]/, 1)[0];
}

function resolveAdsBuildConfig({
  automatedE2E,
  configuredAndroidAppId,
  configuredHomeNativeUnitId,
  isProductionBuild,
  requestedMode,
}) {
  if (automatedE2E) {
    return {
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      homeNativeUnitId: null,
      mode: "off",
    };
  }

  const normalizedMode = normalizeValue(requestedMode);
  if (normalizedMode && !ADS_MODES.has(normalizedMode)) {
    throw new Error(
      "[AdMob] EXPO_PUBLIC_ADMOB_MODE must be off, test, or production",
    );
  }

  const mode = normalizedMode ?? (isProductionBuild ? "off" : "test");
  if (mode !== "production") {
    return {
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      homeNativeUnitId: null,
      mode,
    };
  }

  const androidAppId = normalizeValue(configuredAndroidAppId);
  const homeNativeUnitId = normalizeValue(configuredHomeNativeUnitId);
  const validAppId =
    androidAppId &&
    ADMOB_APP_ID_PATTERN.test(androidAppId) &&
    androidAppId !== GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID;
  const validUnitId =
    homeNativeUnitId &&
    ADMOB_UNIT_ID_PATTERN.test(homeNativeUnitId) &&
    homeNativeUnitId !== GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID;
  const matchingPublisher =
    validAppId &&
    validUnitId &&
    publisherPrefix(androidAppId) === publisherPrefix(homeNativeUnitId);

  if (!validAppId || !validUnitId || !matchingPublisher) {
    throw new Error(
      "[AdMob] production mode requires matching, non-test Android App ID " +
        "and native ad unit ID",
    );
  }

  return { androidAppId, homeNativeUnitId, mode };
}

function setAndroidMetadata(androidManifest, name, value) {
  AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);
  const application =
    AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application["meta-data"] = application["meta-data"] ?? [];
  const existing = application["meta-data"].find(
    (item) => item.$["android:name"] === name,
  );

  if (existing) {
    existing.$["android:value"] = value;
    existing.$["tools:replace"] = "android:value";
    return;
  }

  application["meta-data"].push({
    $: {
      "android:name": name,
      "android:value": value,
      "tools:replace": "android:value",
    },
  });
}

function applyGoogleMobileAdsAndroidManifest(androidManifest, androidAppId) {
  setAndroidMetadata(
    androidManifest,
    "com.google.android.gms.ads.APPLICATION_ID",
    androidAppId,
  );
  setAndroidMetadata(
    androidManifest,
    "com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT",
    "true",
  );
  setAndroidMetadata(
    androidManifest,
    "com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION",
    "true",
  );
  setAndroidMetadata(
    androidManifest,
    "com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING",
    "true",
  );
  return androidManifest;
}

function withAndroidGoogleMobileAds(config, androidAppId) {
  return withAndroidManifest(config, (config) => {
    config.modResults = applyGoogleMobileAdsAndroidManifest(
      config.modResults,
      androidAppId,
    );
    return config;
  });
}

function applyAutomatedE2EAndroidManifest(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) {
    throw new Error("[E2E] Android manifest application node is missing");
  }

  application.$ = {
    ...application.$,
    "android:usesCleartextTraffic": "true",
  };
  return androidManifest;
}

function withAutomatedE2EAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = applyAutomatedE2EAndroidManifest(config.modResults);
    return config;
  });
}

const createAppConfig = ({ config }) => {
  const automatedE2E = process.env.EXPO_PUBLIC_E2E_MODE === "true";
  const ads = resolveAdsBuildConfig({
    automatedE2E,
    configuredAndroidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
    configuredHomeNativeUnitId:
      process.env.EXPO_PUBLIC_ADMOB_HOME_NATIVE_UNIT_ID,
    isProductionBuild:
      process.env.EAS_BUILD === "true" || process.env.NODE_ENV === "production",
    requestedMode: process.env.EXPO_PUBLIC_ADMOB_MODE,
  });

  const resolvedConfig = withAndroidGoogleMobileAds(
    {
      ...config,
      extra: {
        ...config.extra,
        automatedE2E,
        adsMode: ads.mode,
        admobAndroidAppId: ads.androidAppId,
        ...(ads.homeNativeUnitId
          ? { admobHomeNativeUnitId: ads.homeNativeUnitId }
          : {}),
        ...(automatedE2E
          ? {
              e2eSupabaseUrl:
                process.env.EXPO_PUBLIC_SUPABASE_URL ??
                "http://localhost:54321",
              e2eSupabaseAnonKey:
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
                "local-e2e-anon-key",
            }
          : {}),
      },
      android: {
        ...config.android,
      },
    },
    ads.androidAppId,
  );

  // Production keeps Android's secure cleartext default. Only the generated
  // CI E2E native project may reach adb-reversed localhost fixtures.
  return automatedE2E
    ? withAutomatedE2EAndroidManifest(resolvedConfig)
    : resolvedConfig;
};

createAppConfig.GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID =
  GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID;
createAppConfig.GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID =
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID;
createAppConfig.applyAutomatedE2EAndroidManifest =
  applyAutomatedE2EAndroidManifest;
createAppConfig.applyGoogleMobileAdsAndroidManifest =
  applyGoogleMobileAdsAndroidManifest;
createAppConfig.resolveAdsBuildConfig = resolveAdsBuildConfig;

module.exports = createAppConfig;
