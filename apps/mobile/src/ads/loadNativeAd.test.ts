import { describe, expect, it, vi } from "vitest";

import { loadNativeAdWithRetry } from "./loadNativeAd";

describe("loadNativeAdWithRetry", () => {
  it("recovers from a transient native ad request failure", async () => {
    const nativeAd = { headline: "Test ad" };
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("network request failed"))
      .mockResolvedValueOnce(nativeAd);
    const waitForRetry = vi.fn(async () => undefined);

    await expect(
      loadNativeAdWithRetry({ load, waitForRetry }),
    ).resolves.toBe(nativeAd);

    expect(load).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledWith(1);
  });

  it("normalizes an invalid attempt limit to one bounded request", async () => {
    const error = new Error("request failed");
    const load = vi.fn(async () => {
      throw error;
    });

    await expect(
      loadNativeAdWithRetry({
        load,
        maxAttempts: Number.NaN,
        waitForRetry: vi.fn(async () => undefined),
      }),
    ).rejects.toBe(error);

    expect(load).toHaveBeenCalledOnce();
  });
});
