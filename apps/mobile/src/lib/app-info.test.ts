import { describe, expect, it } from "vitest";

import { resolveAppInfo } from "./app-info";

describe("resolveAppInfo", () => {
  it("uses the native app and build versions with validated HTTPS legal URLs", () => {
    expect(
      resolveAppInfo({
        nativeApplicationVersion: " 2.3.4 ",
        nativeBuildVersion: " 42 ",
        configuredVersion: " 1.2.3 ",
        fallbackVersion: "0.1.0",
        privacyPolicyUrl: "https://example.com/privacy",
        termsOfServiceUrl: "https://example.com/terms",
      }),
    ).toEqual({
      privacyPolicyUrl: "https://example.com/privacy",
      termsOfServiceUrl: "https://example.com/terms",
      version: "2.3.4 (42)",
    });
  });

  it("falls back to the configured version when native values are unavailable", () => {
    expect(
      resolveAppInfo({
        nativeApplicationVersion: null,
        nativeBuildVersion: null,
        configuredVersion: " 1.2.3 ",
        fallbackVersion: "0.1.0",
        privacyPolicyUrl: "http://example.com/privacy",
        termsOfServiceUrl: "not-a-url",
      }),
    ).toEqual({
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      version: "1.2.3",
    });
  });

  it("shows the native app version without empty build metadata", () => {
    expect(
      resolveAppInfo({
        nativeApplicationVersion: "2.3.4",
        nativeBuildVersion: " ",
        configuredVersion: "1.2.3",
        fallbackVersion: "0.1.0",
      }).version,
    ).toBe("2.3.4");
  });

  it("falls back to the bundled version when no other version is available", () => {
    expect(
      resolveAppInfo({
        nativeApplicationVersion: null,
        nativeBuildVersion: null,
        configuredVersion: " ",
        fallbackVersion: "0.1.0",
      }).version,
    ).toBe("0.1.0");
  });
});
