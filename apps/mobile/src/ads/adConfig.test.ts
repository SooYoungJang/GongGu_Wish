import { describe, expect, it } from "vitest";

import { resolveAdsRuntimeConfig } from "./adConfig";

const testAndroidAppId = "ca-app-pub-3940256099942544~3347511713";
const testNativeUnitId = "ca-app-pub-3940256099942544/2247696110";
const productionAndroidAppId = "ca-app-pub-1111111111111111~2222222222";
const productionNativeUnitId = "ca-app-pub-1111111111111111/3333333333";

const baseInput = {
  platform: "android" as const,
  automatedE2E: false,
  mode: "off" as const,
  androidAppId: testAndroidAppId,
  productionHomeNativeUnitId: undefined,
  testAndroidAppId,
  testNativeUnitId,
};

describe("resolveAdsRuntimeConfig", () => {
  it("uses only the Google test unit in Android test mode", () => {
    expect(resolveAdsRuntimeConfig({ ...baseInput, mode: "test" })).toEqual({
      enabled: true,
      homeNativeUnitId: testNativeUnitId,
    });
  });

  it("keeps ads disabled in off mode", () => {
    expect(resolveAdsRuntimeConfig(baseInput)).toEqual({
      enabled: false,
      homeNativeUnitId: null,
    });
  });

  it("uses matching validated production IDs only in production mode", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        androidAppId: productionAndroidAppId,
        productionHomeNativeUnitId: productionNativeUnitId,
      }),
    ).toEqual({
      enabled: true,
      homeNativeUnitId: productionNativeUnitId,
    });
  });

  it.each([
    ["missing unit", undefined],
    ["blank unit", "   "],
    ["malformed unit", "not-an-ad-unit"],
    ["swapped app ID", productionAndroidAppId],
    ["Google test unit", testNativeUnitId],
  ])("fails closed for production with %s", (_label, unitId) => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        androidAppId: productionAndroidAppId,
        productionHomeNativeUnitId: unitId,
      }),
    ).toEqual({ enabled: false, homeNativeUnitId: null });
  });

  it.each([
    ["malformed app ID", "not-an-app-id"],
    ["swapped native unit", productionNativeUnitId],
    ["Google test app ID", testAndroidAppId],
    ["different publisher", "ca-app-pub-9999999999999999~2222222222"],
  ])("fails closed for production with %s", (_label, androidAppId) => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        androidAppId,
        productionHomeNativeUnitId: productionNativeUnitId,
      }),
    ).toEqual({ enabled: false, homeNativeUnitId: null });
  });

  it("always disables ads during automated E2E", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        automatedE2E: true,
        mode: "production",
        androidAppId: productionAndroidAppId,
        productionHomeNativeUnitId: productionNativeUnitId,
      }),
    ).toEqual({ enabled: false, homeNativeUnitId: null });
  });

  it.each(["ios", "web", "windows", "macos"] as const)(
    "does not enable the Android-only integration on %s",
    (platform) => {
      expect(
        resolveAdsRuntimeConfig({
          ...baseInput,
          platform,
          mode: "test",
        }),
      ).toEqual({ enabled: false, homeNativeUnitId: null });
    },
  );
});
