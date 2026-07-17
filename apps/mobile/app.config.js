const { withAndroidManifest } = require("expo/config-plugins");

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

  const resolvedConfig = {
    ...config,
    extra: {
      ...config.extra,
      automatedE2E,
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
