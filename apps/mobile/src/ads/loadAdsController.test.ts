import { describe, expect, it, vi } from "vitest";

import type {
  AdsInitializationState,
  GoogleMobileAdsController,
} from "./initializeMobileAds";
import {
  createAdsControllerLoader,
  initializeAdsWithRetry,
} from "./loadAdsController";

const readyState: AdsInitializationState = {
  isReady: true,
  privacyOptionsRequired: false,
};

function createController(): GoogleMobileAdsController {
  return {
    initialize: vi.fn(async () => readyState),
    showPrivacyOptions: vi.fn(),
  };
}

describe("createAdsControllerLoader", () => {
  it("retries after the native module is temporarily unavailable", async () => {
    const controller = createController();
    const loadControllerAttempt = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(controller);
    const loadController = createAdsControllerLoader({
      loadController: loadControllerAttempt,
    });

    await expect(loadController()).resolves.toBeNull();
    await expect(loadController()).resolves.toBe(controller);
    await expect(loadController()).resolves.toBe(controller);

    expect(loadControllerAttempt).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent controller creation", async () => {
    const controller = createController();
    const loadControllerAttempt = vi.fn(async () => controller);
    const loadController = createAdsControllerLoader({
      loadController: loadControllerAttempt,
    });

    const [first, second] = await Promise.all([
      loadController(),
      loadController(),
    ]);

    expect(first).toBe(controller);
    expect(second).toBe(controller);
    expect(loadControllerAttempt).toHaveBeenCalledOnce();
  });
});

describe("initializeAdsWithRetry", () => {
  it("recovers the shared ads provider after the first module load misses", async () => {
    const controller = createController();
    const loadController = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(controller);
    const waitForRetry = vi.fn(async () => undefined);

    await expect(
      initializeAdsWithRetry({ loadController, waitForRetry }),
    ).resolves.toEqual(readyState);

    expect(loadController).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledOnce();
    expect(controller.initialize).toHaveBeenCalledOnce();
  });

  it("retries one transient SDK initialization failure", async () => {
    const controller = createController();
    vi.mocked(controller.initialize)
      .mockRejectedValueOnce(new Error("SDK startup failed"))
      .mockResolvedValueOnce(readyState);
    const waitForRetry = vi.fn(async () => undefined);

    await expect(
      initializeAdsWithRetry({
        loadController: vi.fn(async () => controller),
        waitForRetry,
      }),
    ).resolves.toEqual(readyState);

    expect(controller.initialize).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledOnce();
  });

  it("stops after the bounded SDK initialization retry also fails", async () => {
    const controller = createController();
    vi.mocked(controller.initialize).mockRejectedValue(
      new Error("SDK startup failed"),
    );
    const waitForRetry = vi.fn(async () => undefined);

    await expect(
      initializeAdsWithRetry({
        loadController: vi.fn(async () => controller),
        waitForRetry,
      }),
    ).rejects.toThrow("SDK startup failed");

    expect(controller.initialize).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledOnce();
  });

  it("settles unavailable after both module load attempts miss", async () => {
    const loadController = vi.fn(async () => null);

    await expect(
      initializeAdsWithRetry({
        loadController,
        waitForRetry: vi.fn(async () => undefined),
      }),
    ).resolves.toEqual({
      isReady: false,
      privacyOptionsRequired: false,
    });

    expect(loadController).toHaveBeenCalledTimes(2);
  });
});
