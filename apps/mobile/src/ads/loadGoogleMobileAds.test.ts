import { describe, expect, it, vi } from "vitest";

import { createGoogleMobileAdsModuleLoader } from "./loadGoogleMobileAds";

describe("createGoogleMobileAdsModuleLoader", () => {
  it("never imports the native package inside Expo Go", async () => {
    const importModule = vi.fn();
    const loadModule = createGoogleMobileAdsModuleLoader({
      importModule,
      isExpoGo: true,
    });

    await expect(loadModule()).resolves.toBeNull();
    expect(importModule).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent native module imports", async () => {
    const module = { NativeAd: {} };
    const importModule = vi.fn(async () => module);
    const loadModule = createGoogleMobileAdsModuleLoader({
      importModule,
      isExpoGo: false,
    });

    const [first, second] = await Promise.all([loadModule(), loadModule()]);

    expect(first).toBe(module);
    expect(second).toBe(module);
    expect(importModule).toHaveBeenCalledOnce();
  });

  it("turns a missing native module into a disabled result", async () => {
    const loadModule = createGoogleMobileAdsModuleLoader({
      importModule: vi.fn(async () => {
        throw new Error("RNGoogleMobileAds is unavailable");
      }),
      isExpoGo: false,
    });

    await expect(loadModule()).resolves.toBeNull();
  });

  it("retries after a transient import failure so every ad placement can recover", async () => {
    const module = { NativeAd: {} };
    const importModule = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("native module not ready during startup"),
      )
      .mockResolvedValueOnce(module);
    const loadModule = createGoogleMobileAdsModuleLoader({
      importModule,
      isExpoGo: false,
    });

    await expect(loadModule()).resolves.toBeNull();
    await expect(loadModule()).resolves.toBe(module);
    expect(importModule).toHaveBeenCalledTimes(2);
  });
});
