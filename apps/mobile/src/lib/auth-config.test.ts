import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTH_REDIRECT_URL,
  resolveAuthRedirectUrl,
} from "./auth-config";

describe("resolveAuthRedirectUrl", () => {
  it("uses the build variant callback from Expo extra config", () => {
    expect(
      resolveAuthRedirectUrl({
        authRedirectUrl: "gongguwish-preview://auth/callback",
      }),
    ).toBe("gongguwish-preview://auth/callback");
  });

  it("keeps the Production callback as a safe fallback", () => {
    expect(resolveAuthRedirectUrl(undefined)).toBe(DEFAULT_AUTH_REDIRECT_URL);
    expect(resolveAuthRedirectUrl({ authRedirectUrl: "  " })).toBe(
      DEFAULT_AUTH_REDIRECT_URL,
    );
  });

  it("rejects web origins and unexpected callback paths", () => {
    expect(() =>
      resolveAuthRedirectUrl({
        authRedirectUrl: "https://evil.example/auth/callback",
      }),
    ).toThrow(/redirect URL/);
    expect(() =>
      resolveAuthRedirectUrl({
        authRedirectUrl: "gongguwish-preview://other/path",
      }),
    ).toThrow(/redirect URL/);
  });
});
