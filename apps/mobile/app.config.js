const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID =
  "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID =
  "ca-app-pub-3940256099942544~1458002511";
const GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID =
  "ca-app-pub-3940256099942544/2247696110";
const GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID =
  "ca-app-pub-3940256099942544/1044960115";
const GOOGLE_MOBILE_ADS_TEST_UNIT_IDS = new Set([
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
  GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID,
  "ca-app-pub-3940256099942544/3986624511",
  "ca-app-pub-3940256099942544/2521693316",
]);
const NATIVE_AD_PLACEMENTS = ["home", "reels", "detail"];
const ADS_MODES = new Set(["off", "test", "production"]);
const ADMOB_APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const ADMOB_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const APP_VARIANTS = Object.freeze({
  preview: Object.freeze({
    // Keep the existing internal app ID so installed Preview builds can be
    // upgraded in place.
    applicationId: "com.gonggu.wish.preview",
    key: "preview",
    name: "공구위시 Preview",
    scheme: "gongguwish-preview",
  }),
  production: Object.freeze({
    applicationId: "com.gonggu.wish",
    key: "production",
    name: "공구위시",
    scheme: "gongguwish",
  }),
});
const BACKEND_ENVIRONMENTS = Object.freeze({
  preview: Object.freeze({
    apiProxyUrl: "https://api-preview.gongguwish.com",
    supabaseUrl: "https://xwblovggtvbpiusjfokq.supabase.co",
  }),
  production: Object.freeze({
    apiProxyUrl: "https://api.gongguwish.com",
    supabaseUrl: "https://iosdoheblabfimkjnvfj.supabase.co",
  }),
});

function normalizeValue(value) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function resolveAppVariant(requestedVariant) {
  const key = normalizeValue(requestedVariant) ?? "preview";
  const variant = APP_VARIANTS[key];
  if (!variant) {
    throw new Error("APP_VARIANT must be preview or production");
  }
  return variant;
}

function resolveGoogleServicesFile(
  variant,
  configuredFile,
  productionFallback,
) {
  const environmentFile = normalizeValue(configuredFile);
  if (environmentFile) return environmentFile;
  return variant === "production"
    ? normalizeValue(productionFallback)
    : undefined;
}

function requireHttpsOrigin(value, label) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    throw new Error(`[Environment] ${label} is required`);
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`[Environment] ${label} must be a valid HTTPS origin`);
  }

  const isOriginOnly =
    !parsed.username &&
    !parsed.password &&
    parsed.pathname === "/" &&
    !parsed.search &&
    !parsed.hash;
  if (parsed.protocol !== "https:" || !isOriginOnly) {
    throw new Error(`[Environment] ${label} must be a valid HTTPS origin`);
  }
  return parsed.origin;
}

function resolveBackendEnvironment({
  apiProxyUrl,
  anonKey,
  supabaseUrl,
  variant,
}) {
  if (!normalizeValue(anonKey)) {
    throw new Error("[Environment] Supabase anon key is required");
  }

  const resolvedSupabaseUrl = requireHttpsOrigin(supabaseUrl, "Supabase URL");
  const resolvedApiProxyUrl = requireHttpsOrigin(apiProxyUrl, "API proxy URL");
  const environmentName = variant === "production" ? "production" : "preview";
  const expected = BACKEND_ENVIRONMENTS[environmentName];

  if (
    resolvedSupabaseUrl !== expected.supabaseUrl ||
    resolvedApiProxyUrl !== expected.apiProxyUrl
  ) {
    const label = environmentName === "production" ? "Production" : "Preview";
    throw new Error(`[Environment] ${variant} must use the ${label} backend`);
  }

  return {
    apiProxyUrl: resolvedApiProxyUrl,
    supabaseUrl: resolvedSupabaseUrl,
  };
}

function resolveRuntimeVersion() {
  return { policy: "fingerprint" };
}

function publisherPrefix(id) {
  return id.split(/[~/]/, 1)[0];
}

function resolveProductionAdPlatform({ appId, label, nativeUnitIds, testAppId }) {
  const normalizedAppId = normalizeValue(appId);
  const normalizedUnitIds = Object.fromEntries(
    NATIVE_AD_PLACEMENTS.map((placement) => [
      placement,
      normalizeValue(nativeUnitIds?.[placement]),
    ]),
  );
  const hasAnyValue =
    Boolean(normalizedAppId) ||
    NATIVE_AD_PLACEMENTS.some((placement) => normalizedUnitIds[placement]);
  if (!hasAnyValue) return null;

  const validAppId =
    normalizedAppId &&
    ADMOB_APP_ID_PATTERN.test(normalizedAppId) &&
    normalizedAppId !== testAppId;
  const appPublisher = validAppId
    ? publisherPrefix(normalizedAppId)
    : undefined;
  const validUnitIds = NATIVE_AD_PLACEMENTS.every((placement) => {
    const unitId = normalizedUnitIds[placement];
    return (
      unitId &&
      ADMOB_UNIT_ID_PATTERN.test(unitId) &&
      !GOOGLE_MOBILE_ADS_TEST_UNIT_IDS.has(unitId) &&
      publisherPrefix(unitId) === appPublisher
    );
  });

  if (!validAppId || !validUnitIds) {
    throw new Error(
      `[AdMob] production ${label} ads require one non-test App ID and ` +
        "matching home, reels, and detail native ad unit IDs",
    );
  }

  return {
    appId: normalizedAppId,
    nativeUnitIds: normalizedUnitIds,
  };
}

function resolveAdsBuildConfig({
  automatedE2E,
  configuredAndroidAppId,
  configuredAndroidNativeUnitIds,
  configuredIosAppId,
  configuredIosNativeUnitIds,
  isProductionBuild,
  requestedMode,
}) {
  const disabledNativeUnitIds = { android: null, ios: null };
  if (automatedE2E) {
    return {
      androidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode: "off",
      nativeUnitIds: disabledNativeUnitIds,
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
      iosAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
      mode,
      nativeUnitIds: disabledNativeUnitIds,
    };
  }

  const android = resolveProductionAdPlatform({
    appId: configuredAndroidAppId,
    label: "Android",
    nativeUnitIds: configuredAndroidNativeUnitIds,
    testAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
  });
  const ios = resolveProductionAdPlatform({
    appId: configuredIosAppId,
    label: "iOS",
    nativeUnitIds: configuredIosNativeUnitIds,
    testAppId: GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
  });
  if (!android && !ios) {
    throw new Error(
      "[AdMob] production mode requires a complete Android or iOS ad configuration",
    );
  }

  return {
    androidAppId:
      android?.appId ?? GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
    iosAppId: ios?.appId ?? GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID,
    mode,
    nativeUnitIds: {
      android: android?.nativeUnitIds ?? null,
      ios: ios?.nativeUnitIds ?? null,
    },
  };
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

function applyGoogleMobileAdsIosInfoPlist(infoPlist, iosAppId) {
  // https://developers.google.com/admob/ios/quick-start#update_your_infoplist
  return {
    ...infoPlist,
    GADApplicationIdentifier: iosAppId,
    SKAdNetworkItems: infoPlist?.SKAdNetworkItems ?? [
      { SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" },
    ],
  };
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
  const appVariant = resolveAppVariant(process.env.APP_VARIANT);
  const automatedE2E = process.env.EXPO_PUBLIC_E2E_MODE === "true";
  const ads = resolveAdsBuildConfig({
    automatedE2E,
    configuredAndroidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
    configuredAndroidNativeUnitIds: {
      detail: process.env.EXPO_PUBLIC_ADMOB_DETAIL_NATIVE_UNIT_ID,
      home: process.env.EXPO_PUBLIC_ADMOB_HOME_NATIVE_UNIT_ID,
      reels: process.env.EXPO_PUBLIC_ADMOB_REELS_NATIVE_UNIT_ID,
    },
    configuredIosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
    configuredIosNativeUnitIds: {
      detail: process.env.EXPO_PUBLIC_ADMOB_IOS_DETAIL_NATIVE_UNIT_ID,
      home: process.env.EXPO_PUBLIC_ADMOB_IOS_HOME_NATIVE_UNIT_ID,
      reels: process.env.EXPO_PUBLIC_ADMOB_IOS_REELS_NATIVE_UNIT_ID,
    },
    isProductionBuild: appVariant.key === "production",
    requestedMode: process.env.EXPO_PUBLIC_ADMOB_MODE,
  });
  const productionGoogleServicesFile = config.android?.googleServicesFile;
  const googleServicesFile = resolveGoogleServicesFile(
    appVariant.key,
    process.env.GOOGLE_SERVICES_JSON,
    productionGoogleServicesFile,
  );
  const hasBackendConfiguration = [
    process.env.EXPO_PUBLIC_API_PROXY_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ].some((value) => normalizeValue(value));
  if (!automatedE2E && hasBackendConfiguration) {
    resolveBackendEnvironment({
      apiProxyUrl: process.env.EXPO_PUBLIC_API_PROXY_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      variant: appVariant.key,
    });
  }

  const resolvedConfig = withAndroidGoogleMobileAds(
    {
      ...config,
      name: appVariant.name,
      runtimeVersion: resolveRuntimeVersion(),
      scheme: appVariant.scheme,
      extra: {
        ...config.extra,
        appVariant: appVariant.key,
        authRedirectUrl: `${appVariant.scheme}://auth/callback`,
        automatedE2E,
        adsMode: ads.mode,
        admobAndroidAppId: ads.androidAppId,
        admobIosAppId: ads.iosAppId,
        ...(ads.nativeUnitIds.android
          ? { admobAndroidNativeUnitIds: ads.nativeUnitIds.android }
          : {}),
        ...(ads.nativeUnitIds.ios
          ? { admobIosNativeUnitIds: ads.nativeUnitIds.ios }
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
      ios: {
        ...config.ios,
        bundleIdentifier: appVariant.applicationId,
        infoPlist: applyGoogleMobileAdsIosInfoPlist(
          config.ios?.infoPlist,
          ads.iosAppId,
        ),
      },
      android: {
        ...config.android,
        package: appVariant.applicationId,
        googleServicesFile,
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
createAppConfig.GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID =
  GOOGLE_MOBILE_ADS_TEST_IOS_APP_ID;
createAppConfig.GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID =
  GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID;
createAppConfig.GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID =
  GOOGLE_MOBILE_ADS_TEST_NATIVE_VIDEO_UNIT_ID;
createAppConfig.applyAutomatedE2EAndroidManifest =
  applyAutomatedE2EAndroidManifest;
createAppConfig.applyGoogleMobileAdsAndroidManifest =
  applyGoogleMobileAdsAndroidManifest;
createAppConfig.applyGoogleMobileAdsIosInfoPlist =
  applyGoogleMobileAdsIosInfoPlist;
createAppConfig.resolveAdsBuildConfig = resolveAdsBuildConfig;
createAppConfig.resolveAppVariant = resolveAppVariant;
createAppConfig.resolveBackendEnvironment = resolveBackendEnvironment;
createAppConfig.resolveGoogleServicesFile = resolveGoogleServicesFile;
createAppConfig.resolveRuntimeVersion = resolveRuntimeVersion;

module.exports = createAppConfig;
