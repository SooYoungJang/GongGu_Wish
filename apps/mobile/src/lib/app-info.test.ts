import { describe, expect, it } from "vitest";

import { resolveAppInfo } from "./app-info";

describe("resolveAppInfo", () => {
  it.each(["17", "24", "27"])(
    "distinguishes installed build %s from an applied OTA release",
    (nativeBuildVersion) => {
      const installedApp = {
        nativeApplicationVersion: "0.1.0",
        nativeBuildVersion,
        configuredVersion: "0.1.0",
      };

      expect(
        resolveAppInfo({ ...installedApp, releaseNumber: "18" }).version,
      ).toBe(`0.1.0 (${nativeBuildVersion}) · 업데이트 18`);
      expect(
        resolveAppInfo({ ...installedApp, releaseNumber: "20" }).version,
      ).toBe(`0.1.0 (${nativeBuildVersion}) · 업데이트 20`);
    },
  );

  it("does not present an OTA release as an unknown native build", () => {
    expect(
      resolveAppInfo({
        nativeApplicationVersion: null,
        nativeBuildVersion: null,
        configuredVersion: "0.1.0",
        releaseNumber: " 20 ",
      }).version,
    ).toBe("0.1.0 · 업데이트 20");
  });

  it.each([null, "", "0", "-1", "1.5", "Infinity", "9007199254740992"])(
    "keeps the native build number for invalid release metadata %s",
    (releaseNumber) => {
      expect(
        resolveAppInfo({
          nativeApplicationVersion: "0.1.0",
          nativeBuildVersion: "17",
          releaseNumber,
        }).version,
      ).toBe("0.1.0 (17)");
    },
  );

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
