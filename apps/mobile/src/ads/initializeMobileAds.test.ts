import { describe, expect, it, vi } from "vitest";

import {
  createGoogleMobileAdsInitializer,
  initializeGoogleMobileAds,
} from "./initializeMobileAds";

describe("initializeGoogleMobileAds", () => {
  it("gathers consent before initializing the ads SDK", async () => {
    const calls: string[] = [];
    const initialized = await initializeGoogleMobileAds({
      gatherConsent: vi.fn(async () => {
        calls.push("consent");
        return { canRequestAds: true };
      }),
      getConsentInfo: vi.fn(async () => {
        calls.push("consent-info");
        return { canRequestAds: true };
      }),
      initialize: vi.fn(async () => {
        calls.push("initialize");
      }),
    });

    expect(initialized).toBe(true);
    expect(calls).toEqual(["consent", "consent-info", "initialize"]);
  });

  it("does not initialize when consent state cannot request ads", async () => {
    const initialize = vi.fn();
    const initialized = await initializeGoogleMobileAds({
      gatherConsent: vi.fn(async () => ({ canRequestAds: true })),
      getConsentInfo: vi.fn(async () => ({ canRequestAds: false })),
      initialize,
    });

    expect(initialized).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it("falls back to the stored consent state when gathering fails", async () => {
    const initialize = vi.fn(async () => undefined);
    const initialized = await initializeGoogleMobileAds({
      gatherConsent: vi.fn(async () => {
        throw new Error("consent form unavailable");
      }),
      getConsentInfo: vi.fn(async () => ({ canRequestAds: true })),
      initialize,
    });

    expect(initialized).toBe(true);
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("deduplicates repeated initialization calls", async () => {
    const initialize = vi.fn(async () => undefined);
    const initializeOnce = createGoogleMobileAdsInitializer({
      gatherConsent: vi.fn(async () => ({ canRequestAds: true })),
      getConsentInfo: vi.fn(async () => ({ canRequestAds: true })),
      initialize,
    });

    const [first, second] = await Promise.all([
      initializeOnce(),
      initializeOnce(),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(initialize).toHaveBeenCalledOnce();
  });
});
