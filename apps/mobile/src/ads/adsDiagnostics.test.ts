import { describe, expect, it, vi } from "vitest";

import { emitAdsDiagnostic, getAdsErrorCode } from "./adsDiagnostics";

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

  it("normalizes malformed or missing native error codes", () => {
    expect(getAdsErrorCode({ code: " BAD CODE!? " })).toBe("bad_code");
    expect(getAdsErrorCode(new Error("network details"))).toBe("error");
    expect(getAdsErrorCode(null)).toBe("unknown");
  });
});
