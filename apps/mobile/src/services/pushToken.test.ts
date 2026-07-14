import { describe, expect, it } from "vitest";

import { isExpoPushToken } from "./pushToken";

describe("isExpoPushToken", () => {
  it("accepts Expo token formats", () => {
    expect(isExpoPushToken("ExpoPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
  });

  it("rejects native tokens and malformed values", () => {
    expect(isExpoPushToken("fcm-device-token")).toBe(false);
    expect(isExpoPushToken("ExpoPushToken[]")).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });
});
