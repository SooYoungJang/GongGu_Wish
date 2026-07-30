import type { Dispatch } from "react";
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
    const onAttemptFailure = vi.fn();

    await expect(
      loadNativeAdWithRetry({ load, onAttemptFailure, waitForRetry }),
    ).resolves.toBe(nativeAd);

    expect(load).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledWith(1);
    expect(onAttemptFailure).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, willRetry: true }),
    );
  });

  it("does not overlap a retry with a timed-out request that is still pending", async () => {
    vi.useFakeTimers();
    let resolveRequest!: Dispatch<{ headline: string }>;
    const pendingRequest = new Promise<{ headline: string }>((resolve) => {
      resolveRequest = resolve;
    });
    const load = vi.fn(() => pendingRequest);
    const onAttemptFailure = vi.fn();
    const result = loadNativeAdWithRetry({
      load,
      maxAttempts: 2,
      onAttemptFailure,
      timeoutMs: 15_000,
      waitForRetry: vi.fn(async () => undefined),
    });
    const handledResult = result.catch(() => undefined);

    try {
      await vi.advanceTimersByTimeAsync(15_000);

      expect(load).toHaveBeenCalledOnce();
      expect(onAttemptFailure).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, willRetry: false }),
      );
    } finally {
      resolveRequest({ headline: "Late test ad" });
      await handledResult;
      vi.clearAllTimers();
      vi.useRealTimers();
    }
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
