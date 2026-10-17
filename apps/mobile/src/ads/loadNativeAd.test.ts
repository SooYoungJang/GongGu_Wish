import type { Dispatch } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  getNativeAdRecoveryTestCreative,
  loadNativeAdWithRetry,
} from "./loadNativeAd";

describe("native test creative recovery", () => {
  it.each([
    [true, "video_app_install"],
    [false, "image_app_install"],
  ] as const)("recovers a rejected native response for reel=%s", async (isReel, creative) => {
    const error = {
      code: "googleMobileAds/internal-error",
      message: "Retrieve required value in native ad response failed.",
    };
    const ad = { headline: "Valid native test ad" };
    let testCreative: string | undefined;
    const load = vi.fn(async () => {
      if (testCreative !== creative) throw error;
      return ad;
    });

    await expect(
      loadNativeAdWithRetry({
        load,
        onAttemptFailure: ({ error: failure }) => {
          testCreative ??= getNativeAdRecoveryTestCreative(failure, isReel);
        },
        waitForRetry: async () => undefined,
      }),
    ).resolves.toBe(ad);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(["no-fill", "googleMobileAds/error-code-no-fill"])("handles an outer %s when the adapter rejected a test response", (code) => {
    expect(getNativeAdRecoveryTestCreative({ code }, false)).toBe(
      "image_app_install",
    );
    expect(getNativeAdRecoveryTestCreative({ code }, true)).toBe(
      "video_app_install",
    );
  });

  it.each([
    { code: "network-error" },
    { code: "invalid-request" },
    { code: "request-timeout" },
    { code: "internal-error", message: "Unable to obtain a JavascriptEngine." },
  ])("does not select a creative for an unrelated error %j", (error) => {
    expect(getNativeAdRecoveryTestCreative(error, true)).toBeUndefined();
  });

  it("still rejects after the retry budget when the alternate response fails", async () => {
    const error = {
      code: "internal-error",
      message: "Retrieve required value in native ad response failed.",
    };
    let testCreative: string | undefined;
    const load = vi.fn(async () => {
      throw error;
    });
    await expect(
      loadNativeAdWithRetry({
        load,
        maxAttempts: 2,
        onAttemptFailure: ({ error: failure }) => {
          testCreative ??= getNativeAdRecoveryTestCreative(failure, true);
        },
        waitForRetry: async () => undefined,
      }),
    ).rejects.toBe(error);
    expect(testCreative).toBe("video_app_install");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("loadNativeAdWithRetry", () => {
  it.each(["invalid-request", "googleMobileAds/invalid-request", "app-id-missing"])("does not retry permanent configuration error %s", async (code) => {
    const error = { code };
    const load = vi.fn().mockRejectedValue(error);
    const waitForRetry = vi.fn(async () => undefined);
    await expect(loadNativeAdWithRetry({ load, waitForRetry })).rejects.toBe(error);
    expect(load).toHaveBeenCalledOnce();
    expect(waitForRetry).not.toHaveBeenCalled();
  });

  it.each(["no-fill", "googleMobileAds/error-code-no-fill"])("backs off between bounded %s requests", async (code) => {
    const error = { code };
    const load = vi.fn().mockRejectedValue(error);
    const waitForRetry = vi.fn(async () => undefined);
    const onAttemptFailure = vi.fn();
    await expect(loadNativeAdWithRetry({ load, waitForRetry, onAttemptFailure })).rejects.toBe(error);
    expect(waitForRetry.mock.calls).toEqual([[30_000], [60_000]]);
    expect(onAttemptFailure).toHaveBeenLastCalledWith(expect.objectContaining({
      attempt: 3, willRetry: false, retryDelayMs: null,
    }));
  });

  it("lets a restored connection recover after two network failures", async () => {
    const nativeAd = { headline: "Recovered after reconnect" };
    const load = vi.fn()
      .mockRejectedValueOnce({ code: "network-error" })
      .mockRejectedValueOnce({ code: "network-error" })
      .mockResolvedValueOnce(nativeAd);
    const waitForRetry = vi.fn(async () => undefined);
    await expect(loadNativeAdWithRetry({ load, waitForRetry })).resolves.toBe(nativeAd);
    expect(waitForRetry.mock.calls).toEqual([[1_000], [3_000]]);
  });

  it("preserves a retry until the SDK JavaScript engine becomes ready", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const nativeAd = { headline: "SDK ready" };
    const load = vi.fn(async () => {
      if (Date.now() - startedAt < 60_000) {
        throw {
          code: "googleMobileAds/internal-error",
          message: "Unable to obtain a JavascriptEngine.",
        };
      }
      return nativeAd;
    });
    const waitForRetry = vi.fn(
      (delayMs: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
    );
    const outcome = loadNativeAdWithRetry({ load, waitForRetry }).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );

    try {
      await vi.advanceTimersByTimeAsync(60_000);
      expect(load).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(outcome).resolves.toEqual({ value: nativeAd });
      expect(load).toHaveBeenCalledTimes(3);
      expect(waitForRetry.mock.calls).toEqual([[30_000], [60_000]]);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

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
    expect(waitForRetry).toHaveBeenCalledWith(1_000);
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
