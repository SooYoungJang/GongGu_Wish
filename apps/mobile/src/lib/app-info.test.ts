import { describe, expect, it } from "vitest";

import { resolveAppInfo } from "./app-info";

describe("resolveAppInfo", () => {
  it("uses the runtime version and validated HTTPS legal URLs", () => {
    expect(
      resolveAppInfo({
        configuredVersion: " 1.2.3 ",
        fallbackVersion: "0.1.0",
        privacyPolicyUrl: "https://example.com/privacy",
        termsOfServiceUrl: "https://example.com/terms",
      }),
    ).toEqual({
      privacyPolicyUrl: "https://example.com/privacy",
      termsOfServiceUrl: "https://example.com/terms",
      version: "1.2.3",
    });
  });

  it("falls back to the bundled version and rejects unsafe document URLs", () => {
    expect(
      resolveAppInfo({
        configuredVersion: " ",
        fallbackVersion: "0.1.0",
        privacyPolicyUrl: "http://example.com/privacy",
        termsOfServiceUrl: "not-a-url",
      }),
    ).toEqual({
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      version: "0.1.0",
    });
  });
});
