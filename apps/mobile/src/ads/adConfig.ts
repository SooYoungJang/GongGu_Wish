type SupportedPlatform = "android" | "ios" | "web" | "windows" | "macos";

export type AdsMode = "off" | "test" | "production";

export type AdsRuntimeConfigInput = {
  platform: SupportedPlatform;
  automatedE2E: boolean;
  mode: AdsMode;
  androidAppId?: string;
  productionHomeNativeUnitId?: string;
  testAndroidAppId: string;
  testNativeUnitId: string;
};

export type AdsRuntimeConfig = {
  enabled: boolean;
  homeNativeUnitId: string | null;
};

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const disabledConfig: AdsRuntimeConfig = {
  enabled: false,
  homeNativeUnitId: null,
};

function publisherPrefix(id: string): string {
  return id.split(/[~/]/, 1)[0];
}

export function resolveAdsRuntimeConfig(
  input: AdsRuntimeConfigInput,
): AdsRuntimeConfig {
  if (
    input.platform !== "android" ||
    input.automatedE2E ||
    input.mode === "off"
  ) {
    return disabledConfig;
  }

  const androidAppId = input.androidAppId?.trim();
  if (input.mode === "test") {
    if (androidAppId !== input.testAndroidAppId) return disabledConfig;
    return {
      enabled: true,
      homeNativeUnitId: input.testNativeUnitId,
    };
  }

  const productionUnitId = input.productionHomeNativeUnitId?.trim();
  const validAppId =
    Boolean(androidAppId) &&
    APP_ID_PATTERN.test(androidAppId!) &&
    androidAppId !== input.testAndroidAppId;
  const validUnitId =
    Boolean(productionUnitId) &&
    UNIT_ID_PATTERN.test(productionUnitId!) &&
    productionUnitId !== input.testNativeUnitId;
  const matchingPublisher =
    validAppId &&
    validUnitId &&
    publisherPrefix(androidAppId!) === publisherPrefix(productionUnitId!);

  if (!validAppId || !validUnitId || !matchingPublisher) {
    return disabledConfig;
  }

  return {
    enabled: true,
    homeNativeUnitId: productionUnitId!,
  };
}
