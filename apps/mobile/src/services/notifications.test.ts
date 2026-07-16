import { beforeEach, describe, expect, it, vi } from "vitest";

const { callEdgeFunction } = vi.hoisted(() => ({ callEdgeFunction: vi.fn() }));
const notificationMocks = vi.hoisted(() => ({
  AndroidImportance: { HIGH: 4 },
  getExpoPushTokenAsync: vi
    .fn()
    .mockResolvedValue({ data: "ExpoPushToken[test-token]" }),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("scheduled-1"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: vi.fn().mockResolvedValue([]),
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    TIME_INTERVAL: "timeInterval",
  },
}));

vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));
vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { extra: { eas: { projectId: "project-123" } } },
  },
}));
vi.mock("expo-notifications", () => notificationMocks);

import {
  registerForPushNotifications,
  scheduleGroupBuyStart,
} from "./notifications";

describe("registerForPushNotifications", () => {
  beforeEach(() => {
    callEdgeFunction.mockReset();
    callEdgeFunction.mockResolvedValue({
      data: { registered: true, provider: "expo" },
    });
    notificationMocks.getPermissionsAsync.mockReset().mockResolvedValue({
      status: "granted",
    });
    notificationMocks.requestPermissionsAsync.mockReset().mockResolvedValue({
      status: "granted",
    });
    notificationMocks.scheduleNotificationAsync
      .mockReset()
      .mockResolvedValue("scheduled-1");
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

  it("returns an explicit scheduled result for a valid group-buy start", async () => {
    const result = await scheduleGroupBuyStart(
      "group-buy-1",
      "테스트 공구",
      new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    );

    expect(result.status).toBe("scheduled");
    if (result.status === "scheduled") {
      expect(result.notification.id).toBe("scheduled-1");
      expect(result.notification.groupBuyId).toBe("group-buy-1");
    }
  });

  it("distinguishes a missing start date from a scheduling failure", async () => {
    const result = await scheduleGroupBuyStart(
      "group-buy-1",
      "테스트 공구",
      null,
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "missing-start-date",
    });
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("returns a failed result when the native scheduler rejects", async () => {
    notificationMocks.scheduleNotificationAsync.mockRejectedValueOnce(
      new Error("native scheduler failed"),
    );

    const result = await scheduleGroupBuyStart(
      "group-buy-1",
      "테스트 공구",
      new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    );

    expect(result).toEqual({
      status: "failed",
      reason: "schedule-failed",
    });
  });

  it("reports denied notification permission as unavailable", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });
    notificationMocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });

    const result = await scheduleGroupBuyStart(
      "group-buy-1",
      "테스트 공구",
      new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "permission-denied",
    });
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
