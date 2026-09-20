const { withAppBuildGradle } = require("expo/config-plugins");

function useOptimizedProguard(contents) {
  const defaultRules = /getDefaultProguardFile\((["'])proguard-android(?:-optimize)?\.txt\1\)/g;
  if (!defaultRules.test(contents)) {
    throw new Error("Android release build is missing the default ProGuard rules");
  }
  // Expo SDK 55's default proguard-android.txt disables R8 optimization.
  // Keep library/JNI rules intact while enabling the Android optimized defaults.
  return contents.replace(
    defaultRules,
    'getDefaultProguardFile("proguard-android-optimize.txt")',
  );
}

module.exports = function withAndroidOptimizedProguard(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = useOptimizedProguard(config.modResults.contents);
    return config;
  });
};

module.exports.useOptimizedProguard = useOptimizedProguard;
