import { describe, expect, it, vi } from "vitest";

import {
  emitAdsDiagnostic,
  getAdsErrorCode,
  getAdsErrorReason,
} from "./adsDiagnostics";

describe("adsDiagnostics", () => {
  it("emits one parseable structured event without raw error messages", () => {
    const write = vi.fn();

    emitAdsDiagnostic(
      {
        event: "native_ad_retry",
        placement: "reels",
        attempt: 1,
        maxAttempts: 3,
        errorCode: getAdsErrorCode({
          code: "google-mobile-ads/no-fill",
          message: "request details that must not be logged",
        }),
      },
      write,
    );

    expect(JSON.parse(write.mock.calls[0][0])).toEqual({
      scope: "mobile_ads",
      event: "native_ad_retry",
      placement: "reels",
      attempt: 1,
      maxAttempts: 3,
      errorCode: "google-mobile-ads/no-fill",
    });
    expect(write.mock.calls[0][0]).not.toContain("request details");
  });

  it.each([
    ["No ad config.", "no-ad-config"],
    ["Unable to obtain a JavascriptEngine.", "javascript-engine-unavailable"],
    [
      "Error building request URL: private request details",
      "request-url-error",
    ],
    [
      "Failed to instantiate ad adapter: private details",
      "adapter-instantiation-failed",
    ],
  ])(
    "classifies a stock SDK message without returning it",
    (message, reason) => {
      expect(getAdsErrorReason({ message })).toBe(reason);
      expect(getAdsErrorReason(new Error(message))).toBe(reason);
    },
  );

  it("never returns arbitrary error text, URLs, tokens, or payloads", () => {
    for (const error of [
      null,
      {},
      { message: 42 },
      { message: "request details that must not be logged" },
      { message: "https://private.example.test/?token=private-credential" },
    ]) {
      expect(getAdsErrorReason(error)).toBeUndefined();
    }
    const write = vi.fn();
    emitAdsDiagnostic(
      {
        event: "native_ad_failed",
        errorReason: getAdsErrorReason({
          message:
            "Error building request URL: https://private.example.test/?token=private-credential",
        }),
      },
      write,
    );
    expect(JSON.parse(write.mock.calls[0][0]).errorReason).toBe(
      "request-url-error",
    );
    expect(write.mock.calls[0][0]).not.toContain("private");
  });

  it("normalizes malformed or missing native error codes", () => {
    expect(getAdsErrorCode({ code: " BAD CODE!? " })).toBe("bad_code");
    expect(getAdsErrorCode(new Error("network details"))).toBe("error");
    expect(getAdsErrorCode(null)).toBe("unknown");
  });
});
