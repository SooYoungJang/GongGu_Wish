import { beforeEach, describe, expect, it, vi } from "vitest";

const { callEdgeFunction } = vi.hoisted(() => ({ callEdgeFunction: vi.fn() }));
const linkingMocks = vi.hoisted(() => ({
  openSettings: vi.fn().mockResolvedValue(undefined),
}));
const constantsMock = vi.hoisted(() => ({
  appOwnership: "standalone",
  easConfig: {} as { projectId?: string },
  expoConfig: {
    extra: {
      automatedE2E: true,
      eas: { projectId: "project-123" } as { projectId?: string },
    },
  },
}));
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
  Linking: {
    openSettings: linkingMocks.openSettings,
  },
  Platform: {
    OS: "android",
    select: (options: Record<string, unknown>) =>
      options.android ?? options.default,
  },
}));
vi.mock("expo-constants", () => ({
  default: constantsMock,
}));
vi.mock("expo-notifications", () => notificationMocks);

import {
  buildGroupBuyReminderDates,
  cancelScheduledNotifications,
  ensureNotificationPermission,
  getNotificationPermissionStatus,
  getLastNotificationResponseUrl,
  registerForPushNotifications,
  requestNotificationPermissions,
  scheduleGroupBuyOpeningReminders,
  scheduleGroupBuyReminders,
  scheduleGroupBuyStart,
} from "./notifications";

describe("registerForPushNotifications", () => {
  beforeEach(() => {
    callEdgeFunction.mockReset();
    callEdgeFunction.mockResolvedValue({
      data: { registered: true, provider: "expo" },
    });
    linkingMocks.openSettings.mockReset().mockResolvedValue(undefined);
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
    notificationMocks.getAllScheduledNotificationsAsync
      .mockReset()
      .mockResolvedValue([]);
    notificationMocks.getLastNotificationResponse
      .mockReset()
      .mockReturnValue(null);
    notificationMocks.clearLastNotificationResponseAsync
      .mockReset()
      .mockResolvedValue(undefined);
    constantsMock.expoConfig.extra.eas.projectId = "project-123";
    delete constantsMock.easConfig.projectId;
  });

  it("registers the Expo token through the authenticated Edge Function", async () => {
    await expect(registerForPushNotifications("access-token")).resolves.toEqual(
      {
        status: "registered",
        token: "ExpoPushToken[test-token]",
      },
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

  it("does not request or register a push token when audience policy blocks it", async () => {
    await expect(
      registerForPushNotifications("access-token", {
        shouldContinue: () => false,
      }),
    ).resolves.toEqual({
      status: "cancelled",
      reason: "audience-restricted",
    });

    expect(notificationMocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });

  it("removes a token registered while audience policy changes in flight", async () => {
    let allowed = true;
    const onRegistrationCancelled = vi.fn().mockResolvedValue(undefined);
    callEdgeFunction.mockImplementationOnce(async () => {
      allowed = false;
      return { data: { registered: true, provider: "expo" } };
    });

    await expect(
      registerForPushNotifications("access-token", {
        shouldContinue: () => allowed,
        onRegistrationCancelled,
      }),
    ).resolves.toEqual({
      status: "cancelled",
      reason: "audience-restricted",
    });

    expect(callEdgeFunction).toHaveBeenCalledOnce();
    expect(onRegistrationCancelled).toHaveBeenCalledOnce();
  });

  it("uses an explicit E2E token without contacting Expo", async () => {
    await expect(
      registerForPushNotifications("access-token", {
        requestPermission: false,
        e2eTokenOverride: "ExpoPushToken[gon229-local-e2e]",
      }),
    ).resolves.toEqual({
      status: "registered",
      token: "ExpoPushToken[gon229-local-e2e]",
    });

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

  it("does not require an EAS project ID for an explicit E2E token", async () => {
    delete constantsMock.expoConfig.extra.eas.projectId;

    await expect(
      registerForPushNotifications("access-token", {
        requestPermission: false,
        e2eTokenOverride: "ExpoPushToken[gon229-local-e2e]",
      }),
    ).resolves.toEqual({
      status: "registered",
      token: "ExpoPushToken[gon229-local-e2e]",
    });

    expect(notificationMocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).toHaveBeenCalledOnce();
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
            url: "gongguwish-preview://group-buy/group-buy-1",
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

  it("does not request permission while reconciling stored deadline reminders", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "undetermined",
    });
    notificationMocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });

    await expect(
      scheduleGroupBuyReminders(
        "group-buy-1",
        "테스트 공구",
        "2026-07-20T12:00:00.000Z",
        [3],
        {
          now: Date.parse("2026-07-10T12:00:00.000Z"),
          requestPermission: false,
        },
      ),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "permission-denied",
    });

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("does not request permission while reconciling stored opening reminders", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "undetermined",
    });
    notificationMocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });

    await expect(
      scheduleGroupBuyOpeningReminders(
        "group-buy-1",
        "테스트 공구",
        "2026-07-20T00:00:00.000Z",
        [3],
        9 * 60,
        {
          now: Date.parse("2026-07-10T12:00:00.000Z"),
          requestPermission: false,
        },
      ),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "permission-denied",
    });

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
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
    ).resolves.toEqual({
      status: "unavailable",
      reason: "permission-denied",
    });
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });

  it("reports a missing EAS project ID without requesting a token", async () => {
    delete constantsMock.expoConfig.extra.eas.projectId;

    await expect(registerForPushNotifications("access-token")).resolves.toEqual(
      {
        status: "failed",
        reason: "missing-project-id",
      },
    );
    expect(notificationMocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });

  it("uses the native EAS project ID when the update manifest omits it", async () => {
    delete constantsMock.expoConfig.extra.eas.projectId;
    constantsMock.easConfig.projectId = "native-project-456";

    await expect(registerForPushNotifications("access-token")).resolves.toEqual(
      {
        status: "registered",
        token: "ExpoPushToken[test-token]",
      },
    );
    expect(notificationMocks.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "native-project-456",
    });
  });

  it("retries Expo token acquisition while a new install is still connecting", async () => {
    notificationMocks.getExpoPushTokenAsync
      .mockRejectedValueOnce(new Error("SERVICE_NOT_AVAILABLE"))
      .mockResolvedValueOnce({ data: "ExpoPushToken[retry-token]" });

    await expect(
      registerForPushNotifications("access-token", { retryDelaysMs: [0] }),
    ).resolves.toEqual({
      status: "registered",
      token: "ExpoPushToken[retry-token]",
    });
    expect(notificationMocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(2);
  });

  it("refreshes an expired Supabase session before retrying backend registration", async () => {
    callEdgeFunction
      .mockRejectedValueOnce(
        Object.assign(new Error("session expired"), { status: 401 }),
      )
      .mockResolvedValueOnce({
        data: { registered: true, provider: "expo" },
      });
    const refreshAuthToken = vi.fn().mockResolvedValue("fresh-access-token");

    await expect(
      registerForPushNotifications("expired-access-token", {
        refreshAuthToken,
      }),
    ).resolves.toEqual({
      status: "registered",
      token: "ExpoPushToken[test-token]",
    });
    expect(refreshAuthToken).toHaveBeenCalledOnce();
    expect(callEdgeFunction).toHaveBeenNthCalledWith(
      2,
      "register-push-token",
      { token: "ExpoPushToken[test-token]", provider: "expo" },
      { authToken: "fresh-access-token" },
    );
  });

  it("rejects an invalid Expo token before backend registration", async () => {
    notificationMocks.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: "not-an-expo-token",
    });

    await expect(registerForPushNotifications("access-token")).resolves.toEqual(
      {
        status: "failed",
        reason: "invalid-token",
      },
    );
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });

  it("distinguishes Expo token failures from backend registration failures", async () => {
    notificationMocks.getExpoPushTokenAsync.mockRejectedValueOnce(
      new Error("FCM is unavailable"),
    );

    await expect(
      registerForPushNotifications("access-token", { retryDelaysMs: [] }),
    ).resolves.toEqual({
      status: "failed",
      reason: "token-request-failed",
    });
    expect(callEdgeFunction).not.toHaveBeenCalled();

    callEdgeFunction.mockRejectedValueOnce(new Error("request failed"));
    await expect(registerForPushNotifications("access-token")).resolves.toEqual(
      {
        status: "failed",
        reason: "backend-registration-failed",
      },
    );
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

  it("opens app settings when OS notification permission was previously denied", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
      canAskAgain: false,
    });

    await expect(ensureNotificationPermission()).resolves.toBe(false);

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(linkingMocks.openSettings).toHaveBeenCalledOnce();
  });

  it("requests permission when a denied status can still ask again", async () => {
    notificationMocks.getPermissionsAsync
      .mockResolvedValueOnce({ status: "denied", canAskAgain: true })
      .mockResolvedValueOnce({ status: "denied", canAskAgain: true });
    notificationMocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: "granted",
      canAskAgain: true,
    });

    await expect(ensureNotificationPermission()).resolves.toBe(true);

    expect(notificationMocks.requestPermissionsAsync).toHaveBeenCalledOnce();
    expect(linkingMocks.openSettings).not.toHaveBeenCalled();
  });

  it("consumes a cold-start notification deep link only once", async () => {
    notificationMocks.getLastNotificationResponse.mockReturnValueOnce({
      notification: {
        request: {
          content: {
            data: {
              url: "gongguwish-preview://group-buy/group-buy-1",
            },
          },
        },
      },
    });

    await expect(getLastNotificationResponseUrl()).resolves.toBe(
      "gongguwish-preview://group-buy/group-buy-1",
    );
    expect(
      notificationMocks.clearLastNotificationResponseAsync,
    ).toHaveBeenCalledOnce();
  });

  it("builds future D-days at 9 AM in Asia/Seoul", () => {
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
      { day: 7, date: "2026-07-13T00:00:00.000Z" },
      { day: 3, date: "2026-07-17T00:00:00.000Z" },
      { day: 1, date: "2026-07-19T00:00:00.000Z" },
    ]);
  });

  it("excludes selected D-days whose 9 AM trigger has already passed", () => {
    const now = Date.parse("2026-07-10T12:00:00.000Z");

    expect(
      buildGroupBuyReminderDates(
        "2026-07-13T12:00:00.000Z",
        [1, 3, 7],
        now,
      ).map((item) => ({
        day: item.reminderDay,
        date: item.triggerDate.toISOString(),
      })),
    ).toEqual([
      {
        day: 1,
        date: "2026-07-12T00:00:00.000Z",
      },
    ]);
  });

  it("treats a trigger exactly at now as already passed", () => {
    expect(
      buildGroupBuyReminderDates(
        "2026-07-13T12:00:00.000Z",
        [3],
        Date.parse("2026-07-10T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("schedules selected opening days at the shared KST time", async () => {
    notificationMocks.scheduleNotificationAsync
      .mockResolvedValueOnce("opening-3")
      .mockResolvedValueOnce("opening-0");

    const result = await scheduleGroupBuyOpeningReminders(
      "group-buy-1",
      "테스트 공구",
      "2026-07-20T00:00:00.000Z",
      [0, 3],
      15 * 60 + 30,
      Date.parse("2026-07-10T12:00:00.000Z"),
    );

    expect(result.status).toBe("scheduled");
    if (result.status === "scheduled") {
      expect(result.notifications.map((item) => item.id)).toEqual([
        "opening-3",
        "opening-0",
      ]);
    }
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          title: "공구 오픈 알림",
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "opening",
            notificationEventId: "opening:group-buy-1:3",
            reminderDay: 3,
            url: "gongguwish-preview://group-buy/group-buy-1",
          },
        }),
        trigger: expect.objectContaining({
          type: "date",
          date: new Date("2026-07-17T06:30:00.000Z"),
          channelId: "group-buy-start",
        }),
      }),
    );
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
            notificationEventId: "deadline:group-buy-1:7",
            reminderDay: 7,
            url: "gongguwish-preview://group-buy/group-buy-1",
          },
        }),
        trigger: expect.objectContaining({
          type: "date",
          date: new Date("2026-07-13T00:00:00.000Z"),
          channelId: "group-buy-deadline",
        }),
      }),
    );
  });

  it("cancels orphaned logical reminders before scheduling replacements", async () => {
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: "orphaned-deadline",
        content: {
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "deadline",
            reminderDay: 3,
          },
        },
      },
      {
        identifier: "different-group-buy",
        content: {
          data: {
            groupBuyId: "group-buy-2",
            notificationType: "deadline",
            reminderDay: 3,
          },
        },
      },
      {
        identifier: "pending-opening",
        content: {
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "opening",
            reminderDay: 0,
          },
        },
      },
    ]);

    await scheduleGroupBuyReminders(
      "group-buy-1",
      "테스트 공구",
      "2026-07-20T12:00:00.000Z",
      [3],
      Date.parse("2026-07-10T12:00:00.000Z"),
    );

    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("orphaned-deadline");
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("pending-opening");
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalledWith("different-group-buy");
  });

  it("does not schedule a replacement when any existing reminder cannot cancel", async () => {
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: "deadline-existing",
        content: {
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "deadline",
          },
        },
      },
      {
        identifier: "opening-existing",
        content: {
          data: {
            groupBuyId: "group-buy-1",
            notificationType: "opening",
          },
        },
      },
    ]);
    notificationMocks.cancelScheduledNotificationAsync.mockImplementation(
      async (identifier: string) => {
        if (identifier === "opening-existing") throw new Error("cancel failed");
      },
    );

    await expect(
      scheduleGroupBuyReminders(
        "group-buy-1",
        "테스트 공구",
        "2026-07-20T12:00:00.000Z",
        [3],
        Date.parse("2026-07-10T12:00:00.000Z"),
      ),
    ).resolves.toEqual({ status: "failed", reason: "cancel-failed" });
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
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
