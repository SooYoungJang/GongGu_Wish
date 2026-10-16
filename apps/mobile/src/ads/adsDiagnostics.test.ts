import { describe, expect, it, vi } from "vitest";

import {
  emitAdsDiagnostic,
  getAdsErrorCode,
  getAdsErrorReason,
  getAdsNativeErrorMetadata,
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
    [
      "Retrieve required value in native ad response failed.",
      "native-response-invalid",
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

  it("records a malformed native response without disclosing its payload", () => {
    const error = {
      code: "google-mobile-ads/internal-error",
      message:
        "Retrieve required value in native ad response failed. " +
        "https://private.example.test/?token=private-credential",
    };
    const write = vi.fn();
    emitAdsDiagnostic(
      {
        event: "native_ad_failed",
        errorCode: getAdsErrorCode(error),
        errorReason: getAdsErrorReason(error),
      },
      write,
    );

    expect(JSON.parse(write.mock.calls[0][0])).toEqual({
      scope: "mobile_ads",
      event: "native_ad_failed",
      errorCode: "google-mobile-ads/internal-error",
      errorReason: "native-response-invalid",
    });
    expect(write.mock.calls[0][0]).not.toContain("private");
  });

  it("reads bounded SDK metadata from an Android promise rejection", () => {
    expect(
      getAdsNativeErrorMetadata({
        userInfo: {
          nativeErrorCode: 0,
          googleMobileAdsVersion: "25.2.0",
          responseInfo: "private-response-payload",
        },
      }),
    ).toEqual({ nativeErrorCode: 0, nativeSdkVersion: "25.2.0" });
  });

  it.each([
    null,
    {},
    { userInfo: null },
    { userInfo: "private-response-payload" },
    {
      userInfo: {
        nativeErrorCode: -1,
        googleMobileAdsVersion: "https://private.example.test/?token=secret",
      },
    },
    {
      userInfo: {
        nativeErrorCode: 1.5,
        googleMobileAdsVersion: "25.5.0-private",
      },
    },
    {
      userInfo: { nativeErrorCode: 999999, googleMobileAdsVersion: "25.5.0\n" },
    },
  ])("discards malformed or sensitive native metadata", (error) => {
    expect(getAdsNativeErrorMetadata(error)).toEqual({});
  });
});
