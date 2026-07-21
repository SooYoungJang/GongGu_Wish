type SupportedPlatform = "android" | "ios" | "web" | "windows" | "macos";

export type AdsMode = "off" | "test" | "production";
export type NativeAdPlacement = "home" | "reels" | "detail";

export type NativeAdUnitIds = Record<NativeAdPlacement, string>;
export type ResolvedNativeAdUnitIds = Record<NativeAdPlacement, string | null>;

export type AdsRuntimeConfigInput = {
  platform: SupportedPlatform;
  adAccessResolved: boolean;
  adsRemoved: boolean;
  automatedE2E: boolean;
  mode: AdsMode;
  appId?: string;
  productionNativeUnitIds: Partial<NativeAdUnitIds>;
  testAppId: string;
  testNativeUnitIds: NativeAdUnitIds;
};

export type AdsRuntimeConfig = {
  enabled: boolean;
  nativeUnitIds: ResolvedNativeAdUnitIds;
};

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const NATIVE_AD_PLACEMENTS: NativeAdPlacement[] = [
  "home",
  "reels",
  "detail",
];
const disabledConfig: AdsRuntimeConfig = {
  enabled: false,
  nativeUnitIds: {
    detail: null,
    home: null,
    reels: null,
  },
};

function publisherPrefix(id: string): string {
  return id.split(/[~/]/, 1)[0];
}

function isSupportedNativePlatform(
  platform: SupportedPlatform,
): platform is "android" | "ios" {
  return platform === "android" || platform === "ios";
}

export function resolveAdsRuntimeConfig(
  input: AdsRuntimeConfigInput,
): AdsRuntimeConfig {
  if (
    !isSupportedNativePlatform(input.platform) ||
    !input.adAccessResolved ||
    input.adsRemoved ||
    input.automatedE2E ||
    input.mode === "off"
  ) {
    return disabledConfig;
  }

  const appId = input.appId?.trim();
  if (input.mode === "test") {
    if (appId !== input.testAppId) return disabledConfig;
    return {
      enabled: true,
      nativeUnitIds: input.testNativeUnitIds,
    };
  }

  const validAppId =
    Boolean(appId) &&
    APP_ID_PATTERN.test(appId!) &&
    appId !== input.testAppId;
  if (!validAppId) return disabledConfig;

  const appPublisher = publisherPrefix(appId!);
  const productionNativeUnitIds = {} as NativeAdUnitIds;
  for (const placement of NATIVE_AD_PLACEMENTS) {
    const unitId = input.productionNativeUnitIds[placement]?.trim();
    const validUnitId =
      Boolean(unitId) &&
      UNIT_ID_PATTERN.test(unitId!) &&
      unitId !== input.testNativeUnitIds[placement] &&
      publisherPrefix(unitId!) === appPublisher;
    if (!validUnitId) return disabledConfig;
    productionNativeUnitIds[placement] = unitId!;
  }

  return {
    enabled: true,
    nativeUnitIds: productionNativeUnitIds,
  };
}
