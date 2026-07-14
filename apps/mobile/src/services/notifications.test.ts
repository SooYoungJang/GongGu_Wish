import { beforeEach, describe, expect, it, vi } from "vitest";

const { callEdgeFunction } = vi.hoisted(() => ({ callEdgeFunction: vi.fn() }));

vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));
vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { extra: { eas: { projectId: "project-123" } } },
  },
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  getExpoPushTokenAsync: vi
    .fn()
    .mockResolvedValue({ data: "ExpoPushToken[test-token]" }),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
}));

import { registerForPushNotifications } from "./notifications";

describe("registerForPushNotifications", () => {
  beforeEach(() => {
    callEdgeFunction.mockReset();
    callEdgeFunction.mockResolvedValue({
      data: { registered: true, provider: "expo" },
    });
  });

  it("registers the Expo token through the authenticated Edge Function", async () => {
    await expect(registerForPushNotifications("access-token")).resolves.toBe(
      "ExpoPushToken[test-token]",
    );
    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      {
        token: "ExpoPushToken[test-token]",
        provider: "expo",
      },
      { authToken: "access-token" },
    );
  });
});
