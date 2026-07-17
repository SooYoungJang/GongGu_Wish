type SupportedPlatform = "android" | "ios" | "web" | "windows" | "macos";

export type AdsRuntimeConfigInput = {
  platform: SupportedPlatform;
  isDev: boolean;
  automatedE2E: boolean;
  productionEnabled: boolean;
  productionHomeNativeUnitId?: string;
  testNativeUnitId: string;
};

export type AdsRuntimeConfig = {
  enabled: boolean;
  homeNativeUnitId: string | null;
};

const disabledConfig: AdsRuntimeConfig = {
  enabled: false,
  homeNativeUnitId: null,
};

export function resolveAdsRuntimeConfig(
  input: AdsRuntimeConfigInput,
): AdsRuntimeConfig {
  if (input.platform !== "android" || input.automatedE2E) {
    return disabledConfig;
  }

  if (input.isDev) {
    return {
      enabled: true,
      homeNativeUnitId: input.testNativeUnitId,
    };
  }

  const productionUnitId = input.productionHomeNativeUnitId?.trim();
  if (!input.productionEnabled || !productionUnitId) {
    return disabledConfig;
  }

  return {
    enabled: true,
    homeNativeUnitId: productionUnitId,
  };
}
