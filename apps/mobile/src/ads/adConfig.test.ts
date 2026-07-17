import { describe, expect, it } from "vitest";

import { resolveAdsRuntimeConfig } from "./adConfig";

const baseInput = {
  platform: "android" as const,
  isDev: false,
  automatedE2E: false,
  productionEnabled: false,
  productionHomeNativeUnitId: undefined,
  testNativeUnitId: "test-native-unit",
};

describe("resolveAdsRuntimeConfig", () => {
  it("uses the Google test unit while developing on Android", () => {
    expect(resolveAdsRuntimeConfig({ ...baseInput, isDev: true })).toEqual({
      enabled: true,
      homeNativeUnitId: "test-native-unit",
    });
  });

  it("keeps production ads disabled unless explicitly enabled", () => {
    expect(resolveAdsRuntimeConfig(baseInput)).toEqual({
      enabled: false,
      homeNativeUnitId: null,
    });
  });

  it("uses the configured production unit only when enabled", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        productionEnabled: true,
        productionHomeNativeUnitId: "production-home-native-unit",
      }),
    ).toEqual({
      enabled: true,
      homeNativeUnitId: "production-home-native-unit",
    });
  });

  it("always disables ads during automated E2E", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        isDev: true,
        automatedE2E: true,
      }),
    ).toEqual({
      enabled: false,
      homeNativeUnitId: null,
    });
  });

  it("does not enable the Android-only integration on iOS", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        platform: "ios",
        isDev: true,
      }),
    ).toEqual({
      enabled: false,
      homeNativeUnitId: null,
    });
  });
});
