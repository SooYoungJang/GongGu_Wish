const { withAndroidManifest } = require("expo/config-plugins");

const GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID =
  "ca-app-pub-3940256099942544~3347511713";

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
  const adsEnabled =
    !automatedE2E && process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";
  const configuredAndroidAppId =
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim();
  const homeNativeUnitId =
    process.env.EXPO_PUBLIC_ADMOB_HOME_NATIVE_UNIT_ID?.trim();

  if (adsEnabled && (!configuredAndroidAppId || !homeNativeUnitId)) {
    throw new Error(
      "[AdMob] EXPO_PUBLIC_ADMOB_ANDROID_APP_ID and " +
        "EXPO_PUBLIC_ADMOB_HOME_NATIVE_UNIT_ID are required when ads are enabled",
    );
  }

  const resolvedConfig = {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        "react-native-google-mobile-ads",
        {
          androidAppId:
            adsEnabled && configuredAndroidAppId
              ? configuredAndroidAppId
              : GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
          delayAppMeasurementInit: true,
          optimizeInitialization: true,
          optimizeAdLoading: true,
        },
      ],
    ],
    extra: {
      ...config.extra,
      automatedE2E,
      adsEnabled,
      ...(adsEnabled && homeNativeUnitId
        ? { admobHomeNativeUnitId: homeNativeUnitId }
        : {}),
      ...(automatedE2E
        ? {
            e2eSupabaseUrl:
              process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
            e2eSupabaseAnonKey:
              process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "local-e2e-anon-key",
          }
        : {}),
    },
    android: {
      ...config.android,
    },
  };

  // Production keeps Android's secure cleartext default. Only the generated
  // CI E2E native project may reach adb-reversed localhost fixtures.
  return automatedE2E
    ? withAutomatedE2EAndroidManifest(resolvedConfig)
    : resolvedConfig;
};

createAppConfig.applyAutomatedE2EAndroidManifest =
  applyAutomatedE2EAndroidManifest;

module.exports = createAppConfig;
