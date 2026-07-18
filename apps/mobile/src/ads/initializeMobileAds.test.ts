import { describe, expect, it, vi } from "vitest";

import { createGoogleMobileAdsController } from "./initializeMobileAds";

const consent = (
  canRequestAds: boolean,
  privacyOptionsRequirementStatus: "REQUIRED" | "NOT_REQUIRED" = "NOT_REQUIRED",
) => ({ canRequestAds, privacyOptionsRequirementStatus });

describe("createGoogleMobileAdsController", () => {
  it("gathers consent before initializing the ads SDK", async () => {
    const calls: string[] = [];
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(async () => {
        calls.push("consent");
      }),
      getConsentInfo: vi.fn(async () => {
        calls.push("consent-info");
        return consent(true);
      }),
      showPrivacyOptionsForm: vi.fn(),
      initialize: vi.fn(async () => {
        calls.push("initialize");
      }),
    });

    await expect(controller.initialize()).resolves.toEqual({
      isReady: true,
      privacyOptionsRequired: false,
    });
    expect(calls).toEqual(["consent", "consent-info", "initialize"]);
  });

  it("does not initialize when consent cannot request ads", async () => {
    const initialize = vi.fn();
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(),
      getConsentInfo: vi.fn(async () => consent(false, "REQUIRED")),
      showPrivacyOptionsForm: vi.fn(),
      initialize,
    });

    await expect(controller.initialize()).resolves.toEqual({
      isReady: false,
      privacyOptionsRequired: true,
    });
    expect(initialize).not.toHaveBeenCalled();
  });

  it("falls back to stored consent when gathering fails", async () => {
    const initialize = vi.fn(async () => undefined);
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(async () => {
        throw new Error("consent form unavailable");
      }),
      getConsentInfo: vi.fn(async () => consent(true)),
      showPrivacyOptionsForm: vi.fn(),
      initialize,
    });

    await expect(controller.initialize()).resolves.toMatchObject({
      isReady: true,
    });
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("fails closed when stored consent cannot be read", async () => {
    const initialize = vi.fn();
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(),
      getConsentInfo: vi.fn(async () => {
        throw new Error("consent storage unavailable");
      }),
      showPrivacyOptionsForm: vi.fn(),
      initialize,
    });

    await expect(controller.initialize()).resolves.toEqual({
      isReady: false,
      privacyOptionsRequired: false,
    });
    expect(initialize).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent consent and SDK initialization", async () => {
    const gatherConsent = vi.fn(async () => undefined);
    const initialize = vi.fn(async () => undefined);
    const controller = createGoogleMobileAdsController({
      gatherConsent,
      getConsentInfo: vi.fn(async () => consent(true)),
      showPrivacyOptionsForm: vi.fn(),
      initialize,
    });

    const [first, second] = await Promise.all([
      controller.initialize(),
      controller.initialize(),
    ]);

    expect(first).toEqual(second);
    expect(gatherConsent).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("lets a transient SDK failure retry", async () => {
    const initialize = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(),
      getConsentInfo: vi.fn(async () => consent(true)),
      showPrivacyOptionsForm: vi.fn(),
      initialize,
    });

    await expect(controller.initialize()).rejects.toThrow("network");
    await expect(controller.initialize()).resolves.toMatchObject({
      isReady: true,
    });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("refreshes readiness after the privacy options form", async () => {
    const initialize = vi.fn(async () => undefined);
    const showPrivacyOptionsForm = vi.fn(async () => consent(true));
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(),
      getConsentInfo: vi.fn(async () => consent(false, "REQUIRED")),
      showPrivacyOptionsForm,
      initialize,
    });

    await expect(controller.initialize()).resolves.toEqual({
      isReady: false,
      privacyOptionsRequired: true,
    });
    await expect(controller.showPrivacyOptions()).resolves.toEqual({
      isReady: true,
      privacyOptionsRequired: false,
    });
    expect(showPrivacyOptionsForm).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("turns ad readiness off when privacy choices no longer allow ads", async () => {
    const controller = createGoogleMobileAdsController({
      gatherConsent: vi.fn(),
      getConsentInfo: vi.fn(async () => consent(true, "REQUIRED")),
      showPrivacyOptionsForm: vi.fn(async () => consent(false)),
      initialize: vi.fn(async () => undefined),
    });

    await controller.initialize();
    await expect(controller.showPrivacyOptions()).resolves.toEqual({
      isReady: false,
      privacyOptionsRequired: false,
    });
  });
});
