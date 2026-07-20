import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTH_REDIRECT_URL,
  resolveAuthRedirectUrl,
} from "./auth-config";

describe("resolveAuthRedirectUrl", () => {
  it("uses the build variant callback from Expo extra config", () => {
    expect(
      resolveAuthRedirectUrl({
        authRedirectUrl: "gongguwish-staging://auth/callback",
      }),
    ).toBe("gongguwish-staging://auth/callback");
    expect(
      resolveAuthRedirectUrl({
        authRedirectUrl: "gongguwish://auth/callback",
      }),
    ).toBe("gongguwish://auth/callback");
  });

  it("uses the Staging callback as the safe fallback", () => {
    expect(resolveAuthRedirectUrl(undefined)).toBe(DEFAULT_AUTH_REDIRECT_URL);
    expect(resolveAuthRedirectUrl({ authRedirectUrl: "  " })).toBe(
      DEFAULT_AUTH_REDIRECT_URL,
    );
  });

  it("rejects legacy variants, web origins, and unexpected callback paths", () => {
    for (const legacyUrl of [
      "gongguwish-dev://auth/callback",
      "gongguwish-preview://auth/callback",
    ]) {
      expect(() =>
        resolveAuthRedirectUrl({ authRedirectUrl: legacyUrl }),
      ).toThrow(/redirect URL/);
    }
    expect(() =>
      resolveAuthRedirectUrl({
        authRedirectUrl: "https://evil.example/auth/callback",
      }),
    ).toThrow(/redirect URL/);
    expect(() =>
      resolveAuthRedirectUrl({
        authRedirectUrl: "gongguwish-staging://other/path",
      }),
    ).toThrow(/redirect URL/);
  });
});
