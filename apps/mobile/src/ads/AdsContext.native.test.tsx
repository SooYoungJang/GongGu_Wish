import React, { type Dispatch, useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import Constants from "expo-constants";

import type { AudiencePolicy } from "../audience/audiencePolicy";
import type { AdsContextValue } from "./AdsContext.types";
import { AdsProvider, useAds } from "./AdsContext.native";

const adsModuleMock = vi.hoisted(() => ({
  getGoogleMobileAdsModule: vi.fn(),
}));

const adultAudiencePolicy: AudiencePolicy = {
  resolved: true,
  canUseApp: true,
  canAuthenticate: true,
  canRequestAds: true,
  canRecordBehaviorSignals: true,
};

vi.mock("./loadGoogleMobileAds", () => ({
  getGoogleMobileAdsModule: adsModuleMock.getGoogleMobileAdsModule,
}));

function AdsStateProbe({ onState }: { onState: Dispatch<AdsContextValue> }) {
  const ads = useAds();

  useEffect(() => {
    onState(ads);
  }, [ads, onState]);

  return null;
}

afterEach(() => {
  vi.useRealTimers();
  adsModuleMock.getGoogleMobileAdsModule.mockReset();
});

describe("AdsProvider", () => {
  it("publishes a ready shared context after a transient native module miss", async () => {
    vi.useFakeTimers();
    Object.assign(Constants.expoConfig?.extra ?? {}, {
      adsMode: "test",
      admobRequestsEnabled: true,
      automatedE2E: false,
      admobAndroidAppId: "ca-app-pub-3940256099942544~3347511713",
      admobIosAppId: "ca-app-pub-3940256099942544~1458002511",
    });
    const initialize = vi.fn(async () => undefined);
    const module = {
      AdsConsent: {
        gatherConsent: vi.fn(async () => undefined),
        getConsentInfo: vi.fn(async () => ({
          canRequestAds: true,
          privacyOptionsRequirementStatus: "NOT_REQUIRED",
        })),
        showPrivacyOptionsForm: vi.fn(),
      },
      default: vi.fn(() => ({ initialize })),
    };
    adsModuleMock.getGoogleMobileAdsModule
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(module);
    const states: AdsContextValue[] = [];
    const onState = (value: AdsContextValue) => states.push(value);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AdsProvider audiencePolicy={adultAudiencePolicy}>
          <AdsStateProbe onState={onState} />
        </AdsProvider>,
      );
      await Promise.resolve();
    });

    expect(states.at(-1)).toMatchObject({
      enabled: true,
      isReady: false,
      isSettled: false,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(states.at(-1)).toMatchObject({
      enabled: true,
      isReady: true,
      isSettled: true,
    });
    expect(adsModuleMock.getGoogleMobileAdsModule).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenCalledOnce();

    act(() => renderer!.unmount());
  });

  it("does not load the native SDK while the global request switch is off", async () => {
    Object.assign(Constants.expoConfig?.extra ?? {}, {
      adsMode: "test",
      admobRequestsEnabled: false,
      automatedE2E: false,
      admobAndroidAppId: "ca-app-pub-3940256099942544~3347511713",
    });
    const states: AdsContextValue[] = [];

    await act(async () => {
      TestRenderer.create(
        <AdsProvider audiencePolicy={adultAudiencePolicy}>
          <AdsStateProbe onState={(value) => states.push(value)} />
        </AdsProvider>,
      );
      await Promise.resolve();
    });

    expect(states.at(-1)).toMatchObject({
      enabled: false,
      isReady: false,
      isSettled: true,
    });
    expect(adsModuleMock.getGoogleMobileAdsModule).not.toHaveBeenCalled();
  });
});
