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
  getLastNotificationResponse: vi.fn().mockReturnValue(null),
  clearLastNotificationResponseAsync: vi.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: vi.fn(() => ({
    remove: vi.fn(),
  })),
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
}));

vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));
vi.mock("react-native", () => ({
  Platform: {
    OS: "android",
    select: (options: Record<string, unknown>) =>
      options.android ?? options.default,
  },
}));
vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: {
      extra: {
        automatedE2E: true,
        eas: { projectId: "project-123" },
      },
    },
  },
}));
vi.mock("expo-notifications", () => notificationMocks);

import {
  buildGroupBuyReminderDates,
  cancelScheduledNotifications,
  getNotificationPermissionStatus,
  getLastNotificationResponseUrl,
  registerForPushNotifications,
  requestNotificationPermissions,
  scheduleGroupBuyReminders,
  scheduleGroupBuyStart,
  scheduleTestNotification,
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
    notificationMocks.getExpoPushTokenAsync.mockReset().mockResolvedValue({
      data: "ExpoPushToken[test-token]",
    });
    notificationMocks.setNotificationChannelAsync
      .mockReset()
      .mockResolvedValue(undefined);
    notificationMocks.scheduleNotificationAsync
      .mockReset()
      .mockResolvedValue("scheduled-1");
    notificationMocks.cancelScheduledNotificationAsync
      .mockReset()
      .mockResolvedValue(undefined);
    notificationMocks.getLastNotificationResponse
      .mockReset()
      .mockReturnValue(null);
    notificationMocks.clearLastNotificationResponseAsync
      .mockReset()
      .mockResolvedValue(undefined);
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

  it("uses an explicit E2E token without contacting Expo", async () => {
    await expect(
      registerForPushNotifications("access-token", {
        requestPermission: false,
        e2eTokenOverride: "ExpoPushToken[gon229-local-e2e]",
      }),
    ).resolves.toBe("ExpoPushToken[gon229-local-e2e]");

    expect(notificationMocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      {
        token: "ExpoPushToken[gon229-local-e2e]",
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
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: {
            groupBuyId: "group-buy-1",
            url: "gongguwish://group-buy/group-buy-1",
          },
        }),
      }),
    );
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

  it("does not prompt for permission during background token registration", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "undetermined",
    });

    await expect(
      registerForPushNotifications("access-token", {
        requestPermission: false,
      }),
    ).resolves.toBeNull();
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });

  it("creates Android channels before requesting first-run permission", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "undetermined",
    });

    await expect(requestNotificationPermissions()).resolves.toBe(true);

    expect(notificationMocks.setNotificationChannelAsync).toHaveBeenCalled();
    expect(
      notificationMocks.setNotificationChannelAsync.mock.invocationCallOrder[0],
    ).toBeLessThan(
      notificationMocks.requestPermissionsAsync.mock.invocationCallOrder[0],
    );
  });

  it("does not report notification availability when channel setup fails", async () => {
    notificationMocks.setNotificationChannelAsync.mockRejectedValueOnce(
      new Error("channel setup failed"),
    );

    await expect(requestNotificationPermissions()).resolves.toBe(false);
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("reads OS permission status without prompting", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });

    await expect(getNotificationPermissionStatus()).resolves.toBe("denied");
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("consumes a cold-start notification deep link only once", async () => {
    notificationMocks.getLastNotificationResponse.mockReturnValueOnce({
      notification: {
        request: {
          content: {
            data: {
              url: "gongguwish://group-buy/group-buy-1",
            },
          },
        },
      },
    });

    await expect(getLastNotificationResponseUrl()).resolves.toBe(
      "gongguwish://group-buy/group-buy-1",
    );
    expect(
      notificationMocks.clearLastNotificationResponseAsync,
    ).toHaveBeenCalledOnce();
  });

  it("embeds a canonical detail URL in the Android E2E test notification", async () => {
    await expect(scheduleTestNotification(3, "group-buy-1")).resolves.toBe(
      "scheduled-1",
    );
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        data: {
          groupBuyId: "group-buy-1",
          notificationType: "general",
          test: true,
          url: "gongguwish://group-buy/group-buy-1",
        },
      }),
      trigger: expect.objectContaining({ seconds: 3 }),
    });
  });

  it("builds chronological future D-7, D-3, and D-1 reminder dates", () => {
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    expect(
      buildGroupBuyReminderDates(
        "2026-07-20T12:00:00.000Z",
        [1, 7, 3, 7],
        now,
      ).map((item) => ({
        day: item.reminderDay,
        date: item.triggerDate.toISOString(),
      })),
    ).toEqual([
      { day: 7, date: "2026-07-13T12:00:00.000Z" },
      { day: 3, date: "2026-07-17T12:00:00.000Z" },
      { day: 1, date: "2026-07-19T12:00:00.000Z" },
    ]);
  });

  it("schedules every selected future deadline reminder with a canonical URL", async () => {
    notificationMocks.scheduleNotificationAsync
      .mockResolvedValueOnce("deadline-7")
      .mockResolvedValueOnce("deadline-3")
      .mockResolvedValueOnce("deadline-1");
    const now = Date.parse("2026-07-10T12:00:00.000Z");

    const result = await scheduleGroupBuyReminders(
      "group-buy-1",
      "테스트 공구",
      "2026-07-20T12:00:00.000Z",
      [1, 3, 7],
      now,
    );

    expect(result.status).toBe("scheduled");
    if (result.status === "scheduled") {
      expect(result.notifications.map((item) => item.id)).toEqual([
        "deadline-7",
        "deadline-3",
        "deadline-1",
      ]);
    }
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(
      3,
    );
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "deadline",
            url: "gongguwish://group-buy/group-buy-1",
          },
        }),
        trigger: expect.objectContaining({
          type: "date",
          date: new Date("2026-07-13T12:00:00.000Z"),
          channelId: "group-buy-deadline",
        }),
      }),
    );
  });

  it("rolls back partial native schedules when a later reminder fails", async () => {
    notificationMocks.scheduleNotificationAsync
      .mockResolvedValueOnce("deadline-7")
      .mockRejectedValueOnce(new Error("scheduler failed"));

    await expect(
      scheduleGroupBuyReminders(
        "group-buy-1",
        "테스트 공구",
        "2026-07-20T12:00:00.000Z",
        [3, 7],
        Date.parse("2026-07-10T12:00:00.000Z"),
      ),
    ).resolves.toEqual({ status: "failed", reason: "schedule-failed" });
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("deadline-7");
  });

  it("returns IDs that survive a failed partial-schedule rollback", async () => {
    notificationMocks.scheduleNotificationAsync
      .mockResolvedValueOnce("deadline-7")
      .mockRejectedValueOnce(new Error("scheduler failed"));
    notificationMocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(
      new Error("cancel failed"),
    );

    const result = await scheduleGroupBuyReminders(
      "group-buy-1",
      "테스트 공구",
      "2026-07-20T12:00:00.000Z",
      [3, 7],
      Date.parse("2026-07-10T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: "failed",
      reason: "schedule-failed",
      notifications: [
        expect.objectContaining({ id: "deadline-7", reminderDay: 7 }),
      ],
    });
  });

  it("cancels deduplicated legacy and multi-reminder IDs", async () => {
    await expect(
      cancelScheduledNotifications([
        "legacy-id",
        "deadline-3",
        "legacy-id",
        null,
      ]),
    ).resolves.toEqual({
      cancelledIds: ["legacy-id", "deadline-3"],
      failedIds: [],
    });
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(2);
  });
});
