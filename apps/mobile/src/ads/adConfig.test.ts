import { describe, expect, it } from "vitest";

import { resolveAdsRuntimeConfig } from "./adConfig";

const testAndroidAppId = "ca-app-pub-3940256099942544~3347511713";
const testIosAppId = "ca-app-pub-3940256099942544~1458002511";
const testAndroidNativeUnitId = "ca-app-pub-3940256099942544/2247696110";
const testAndroidNativeVideoUnitId =
  "ca-app-pub-3940256099942544/1044960115";
const testIosNativeUnitId = "ca-app-pub-3940256099942544/3986624511";
const testIosNativeVideoUnitId = "ca-app-pub-3940256099942544/2521693316";
const productionAppId = "ca-app-pub-1111111111111111~2222222222";
const productionNativeUnitIds = {
  detail: "ca-app-pub-1111111111111111/3333333333",
  home: "ca-app-pub-1111111111111111/4444444444",
  reels: "ca-app-pub-1111111111111111/5555555555",
};

const baseInput = {
  platform: "android" as const,
  adAccessResolved: true,
  adsRemoved: false,
  automatedE2E: false,
  mode: "off" as const,
  appId: testAndroidAppId,
  productionNativeUnitIds: {},
  testAppId: testAndroidAppId,
  testNativeUnitIds: {
    detail: testAndroidNativeUnitId,
    home: testAndroidNativeUnitId,
    reels: testAndroidNativeVideoUnitId,
  },
};

const disabledConfig = {
  enabled: false,
  nativeUnitIds: {
    detail: null,
    home: null,
    reels: null,
  },
};

describe("resolveAdsRuntimeConfig", () => {
  it("uses Google's Android native video unit for Reels in test mode", () => {
    expect(resolveAdsRuntimeConfig({ ...baseInput, mode: "test" })).toEqual({
      enabled: true,
      nativeUnitIds: {
        detail: testAndroidNativeUnitId,
        home: testAndroidNativeUnitId,
        reels: testAndroidNativeVideoUnitId,
      },
    });
  });

  it("uses Google's iOS native and native video units in test mode", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        platform: "ios",
        mode: "test",
        appId: testIosAppId,
        testAppId: testIosAppId,
        testNativeUnitIds: {
          detail: testIosNativeUnitId,
          home: testIosNativeUnitId,
          reels: testIosNativeVideoUnitId,
        },
      }),
    ).toEqual({
      enabled: true,
      nativeUnitIds: {
        detail: testIosNativeUnitId,
        home: testIosNativeUnitId,
        reels: testIosNativeVideoUnitId,
      },
    });
  });

  it("keeps ads disabled in off mode", () => {
    expect(resolveAdsRuntimeConfig(baseInput)).toEqual(disabledConfig);
  });

  it("uses all matching production native units", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        appId: productionAppId,
        productionNativeUnitIds,
      }),
    ).toEqual({
      enabled: true,
      nativeUnitIds: productionNativeUnitIds,
    });
  });

  it.each(["home", "reels", "detail"] as const)(
    "fails closed when the production %s unit is missing",
    (placement) => {
      expect(
        resolveAdsRuntimeConfig({
          ...baseInput,
          mode: "production",
          appId: productionAppId,
          productionNativeUnitIds: {
            ...productionNativeUnitIds,
            [placement]: undefined,
          },
        }),
      ).toEqual(disabledConfig);
    },
  );

  it.each([
    ["malformed unit", "not-an-ad-unit"],
    ["swapped app ID", productionAppId],
    ["Google test unit", testAndroidNativeUnitId],
    ["different publisher", "ca-app-pub-9999999999999999/3333333333"],
  ])("fails closed for production with a %s", (_label, detailUnitId) => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        appId: productionAppId,
        productionNativeUnitIds: {
          ...productionNativeUnitIds,
          detail: detailUnitId,
        },
      }),
    ).toEqual(disabledConfig);
  });

  it.each([
    ["malformed app ID", "not-an-app-id"],
    ["swapped native unit", productionNativeUnitIds.home],
    ["Google test app ID", testAndroidAppId],
    ["different publisher", "ca-app-pub-9999999999999999~2222222222"],
  ])("fails closed for production with a %s", (_label, appId) => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        mode: "production",
        appId,
        productionNativeUnitIds,
      }),
    ).toEqual(disabledConfig);
  });

  it("always disables ads for ad-free subscribers", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        adsRemoved: true,
        mode: "production",
        appId: productionAppId,
        productionNativeUnitIds,
      }),
    ).toEqual(disabledConfig);
  });

  it("does not initialize ads before subscription access is resolved", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        adAccessResolved: false,
        mode: "test",
      }),
    ).toEqual(disabledConfig);
  });

  it("always disables ads during automated E2E", () => {
    expect(
      resolveAdsRuntimeConfig({
        ...baseInput,
        automatedE2E: true,
        mode: "production",
        appId: productionAppId,
        productionNativeUnitIds,
      }),
    ).toEqual(disabledConfig);
  });

  it.each(["web", "windows", "macos"] as const)(
    "does not enable the native integration on %s",
    (platform) => {
      expect(
        resolveAdsRuntimeConfig({
          ...baseInput,
          platform,
          mode: "test",
        }),
      ).toEqual(disabledConfig);
    },
  );
});
