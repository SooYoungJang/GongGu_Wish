import type { NotificationTriggerInput } from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { callEdgeFunction } from "../lib/postgrest-client";
import { isAutomatedE2E } from "../lib/automatedE2E";
import { isExpoPushToken } from "./pushToken";
import type { NotificationReminderDay } from "./notificationPreferences";
import {
  buildGroupBuyNotificationUrl,
  notificationResponseToUrl,
} from "./notificationPayload";

// Expo Go does not fully support expo-notifications native modules.
// Lazy-load to avoid importing the module at app startup in Expo Go.
export const IS_EXPO_GO = Constants.appOwnership === "expo";
let NotificationsModule: typeof import("expo-notifications") | null = null;

async function getNotifications() {
  if (IS_EXPO_GO || NotificationsModule) return NotificationsModule;
  try {
    NotificationsModule = await import("expo-notifications");
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    NotificationsModule = null;
  }
  return NotificationsModule;
}

export type NotificationAvailability =
  | { status: "available" }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | {
      status: "unavailable";
      reason: NotificationPermissionFailureReason;
    };

export type NotificationPermissionFailureReason =
  | "permission-denied"
  | "permission-request-failed";

export type GroupBuyStartUnavailableReason =
  | "missing-start-date"
  | "invalid-start-date"
  | "past-start-date"
  | NotificationPermissionFailureReason;

export type ScheduleGroupBuyStartResult =
  | { status: "scheduled"; notification: ScheduledNotification }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | { status: "unavailable"; reason: GroupBuyStartUnavailableReason }
  | {
      status: "failed";
      reason: "invalid-group-buy-id" | "schedule-failed";
    };

export type CancelScheduledNotificationResult =
  | { status: "cancelled" }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | { status: "failed"; reason: "cancel-failed" };

async function getNotificationAvailability(
  requestPermission = true,
): Promise<NotificationAvailability> {
  if (IS_EXPO_GO) return { status: "unsupported", reason: "expo-go" };

  const Notifications = await getNotifications();
  if (!Notifications) return { status: "unsupported", reason: "native-module" };

  try {
    if (Platform.OS === "android") {
      await Promise.all([
        Notifications.setNotificationChannelAsync("group-buy-start", {
          name: "공구 시작 알림",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#F0445E",
        }),
        Notifications.setNotificationChannelAsync("group-buy-deadline", {
          name: "공구 마감 알림",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#F0445E",
        }),
      ]);
    }

    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    const currentStatus = (existingStatus as { status?: string }).status;
    if (currentStatus !== "granted") {
      if (!requestPermission) {
        return { status: "unavailable", reason: "permission-denied" };
      }
      finalStatus = await Notifications.requestPermissionsAsync();
    }

    const finalStatusValue = (finalStatus as { status?: string }).status;
    if (finalStatusValue !== "granted") {
      return { status: "unavailable", reason: "permission-denied" };
    }

    return { status: "available" };
  } catch {
    return { status: "unavailable", reason: "permission-request-failed" };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  return (await getNotificationAvailability()).status === "available";
}

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported"
  | "error";

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (IS_EXPO_GO) return "unsupported";
  const Notifications = await getNotifications();
  if (!Notifications) return "unsupported";
  try {
    const result = await Notifications.getPermissionsAsync();
    const status = (result as { status?: string }).status;
    if (status === "granted" || status === "denied") return status;
    return "undetermined";
  } catch {
    return "error";
  }
}

export function getEasProjectId(): string | null {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
}

export async function registerForPushNotifications(
  authToken?: string,
  options: {
    requestPermission?: boolean;
    e2eTokenOverride?: string;
  } = {},
): Promise<string | null> {
  if (IS_EXPO_GO) return null;

  try {
    const projectId = getEasProjectId();
    if (
      !projectId ||
      (await getNotificationAvailability(options.requestPermission !== false))
        .status !== "available"
    ) {
      return null;
    }

    let token = isAutomatedE2E() ? options.e2eTokenOverride : undefined;
    if (token === undefined) {
      const Notifications = await getNotifications();
      if (!Notifications) return null;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    if (!isExpoPushToken(token)) return null;

    await callEdgeFunction(
      "register-push-token",
      { token, provider: "expo" },
      { authToken },
    );
    return token;
  } catch (error) {
    console.warn(
      "[Notifications] Push token registration failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export type ScheduledNotification = {
  id: string;
  groupBuyId: string;
  productName: string | null;
  triggerDate: Date | null;
  reminderDay?: NotificationReminderDay;
};

export type GroupBuyReminderUnavailableReason =
  | "missing-end-date"
  | "invalid-end-date"
  | "past-reminder-window"
  | NotificationPermissionFailureReason;

export type ScheduleGroupBuyRemindersResult =
  | { status: "scheduled"; notifications: ScheduledNotification[] }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | { status: "unavailable"; reason: GroupBuyReminderUnavailableReason }
  | {
      status: "failed";
      reason: "invalid-group-buy-id" | "schedule-failed";
      notifications?: ScheduledNotification[];
    };

const DAY_MS = 86_400_000;

export function buildGroupBuyReminderDates(
  endDate: string,
  reminderDays: readonly number[],
  now = Date.now(),
) {
  const deadline = new Date(endDate);
  if (Number.isNaN(deadline.getTime())) return [];
  const allowed = new Set<number>([1, 3, 7]);
  return [...new Set(reminderDays)]
    .filter((day): day is NotificationReminderDay => allowed.has(day))
    .map((reminderDay) => ({
      reminderDay,
      triggerDate: new Date(deadline.getTime() - reminderDay * DAY_MS),
    }))
    .filter(({ triggerDate }) => triggerDate.getTime() > now)
    .sort(
      (left, right) => left.triggerDate.getTime() - right.triggerDate.getTime(),
    );
}

export async function scheduleGroupBuyReminders(
  groupBuyId: string,
  productName: string | null,
  endDate: string | null,
  reminderDays: readonly NotificationReminderDay[],
  now = Date.now(),
): Promise<ScheduleGroupBuyRemindersResult> {
  const url = buildGroupBuyNotificationUrl(groupBuyId);
  if (!url) return { status: "failed", reason: "invalid-group-buy-id" };
  if (!endDate) return { status: "unavailable", reason: "missing-end-date" };
  if (Number.isNaN(new Date(endDate).getTime())) {
    return { status: "unavailable", reason: "invalid-end-date" };
  }

  const reminders = buildGroupBuyReminderDates(endDate, reminderDays, now);
  if (reminders.length === 0) {
    return { status: "unavailable", reason: "past-reminder-window" };
  }

  const availability = await getNotificationAvailability();
  if (availability.status !== "available") return availability;
  const Notifications = await getNotifications();
  if (!Notifications) return { status: "unsupported", reason: "native-module" };

  const scheduled: ScheduledNotification[] = [];
  try {
    for (const reminder of reminders) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "공구 마감 알림",
          body: `${productName ?? "공동구매"} 마감까지 ${reminder.reminderDay}일 남았어요.`,
          data: {
            groupBuyId: groupBuyId.trim(),
            notificationType: "deadline",
            url,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.triggerDate,
          channelId: "group-buy-deadline",
        } as NotificationTriggerInput,
      });
      scheduled.push({
        id: identifier,
        groupBuyId: groupBuyId.trim(),
        productName,
        reminderDay: reminder.reminderDay,
        triggerDate: reminder.triggerDate,
      });
    }
    return { status: "scheduled", notifications: scheduled };
  } catch {
    const rollbackResults = await Promise.all(
      scheduled.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.id)
          .then(() => null)
          .catch(() => notification),
      ),
    );
    const survivingNotifications = rollbackResults.filter(
      (notification): notification is ScheduledNotification =>
        notification !== null,
    );
    return survivingNotifications.length > 0
      ? {
          status: "failed",
          reason: "schedule-failed",
          notifications: survivingNotifications,
        }
      : { status: "failed", reason: "schedule-failed" };
  }
}

export type GroupBuyAlertState =
  | { status: "idle" }
  | { status: "pending"; action: "enable" | "disable" }
  | {
      status: "enabled";
      notificationId: string | null;
      scheduledFor: string | null;
      notificationIds?: string[];
      scheduledForDates?: string[];
    }
  | {
      status: "failed";
      action: "enable" | "disable";
      reason:
        | "invalid-group-buy-id"
        | "schedule-failed"
        | "cancel-failed"
        | "mirror-failed";
      retryable: boolean;
      notificationId?: string | null;
      scheduledFor?: string | null;
      notificationIds?: string[];
      scheduledForDates?: string[];
    }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | {
      status: "unavailable";
      reason:
        | GroupBuyStartUnavailableReason
        | GroupBuyReminderUnavailableReason;
    };

export async function scheduleGroupBuyStart(
  groupBuyId: string,
  productName: string | null,
  startDate: string | null,
): Promise<ScheduleGroupBuyStartResult> {
  const normalizedGroupBuyId = groupBuyId.trim();
  const url = buildGroupBuyNotificationUrl(normalizedGroupBuyId);
  if (!url) {
    return { status: "failed", reason: "invalid-group-buy-id" };
  }
  if (!startDate) {
    return { status: "unavailable", reason: "missing-start-date" };
  }

  const triggerDate = new Date(startDate);
  if (Number.isNaN(triggerDate.getTime())) {
    return { status: "unavailable", reason: "invalid-start-date" };
  }

  const notifyAt = new Date(triggerDate.getTime() - 60 * 60 * 1000);
  if (notifyAt.getTime() <= Date.now()) {
    return { status: "unavailable", reason: "past-start-date" };
  }

  const availability = await getNotificationAvailability();
  if (availability.status !== "available") return availability;

  const Notifications = await getNotifications();
  if (!Notifications) return { status: "unsupported", reason: "native-module" };

  const triggerSeconds = Math.round((notifyAt.getTime() - Date.now()) / 1000);
  if (triggerSeconds <= 0) {
    return { status: "unavailable", reason: "past-start-date" };
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "공구 시작 알림",
        body: `${productName ?? "공동구매"} 공구가 곧 시작될 예정이에요!`,
        data: { groupBuyId: normalizedGroupBuyId, url },
      },
      trigger: Platform.select({
        ios: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: notifyAt.getHours(),
          minute: notifyAt.getMinutes(),
          day: notifyAt.getDate(),
          month: notifyAt.getMonth() + 1,
          year: notifyAt.getFullYear(),
        },
        android: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          channelId: "group-buy-start",
        },
        default: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          channelId: "group-buy-start",
        },
      }) as NotificationTriggerInput,
    });

    return {
      status: "scheduled",
      notification: {
        id: identifier,
        groupBuyId: normalizedGroupBuyId,
        productName,
        triggerDate: notifyAt,
      },
    };
  } catch {
    return { status: "failed", reason: "schedule-failed" };
  }
}

export async function cancelScheduledNotification(
  identifier: string,
): Promise<CancelScheduledNotificationResult> {
  if (IS_EXPO_GO) return { status: "unsupported", reason: "expo-go" };
  const Notifications = await getNotifications();
  if (!Notifications) return { status: "unsupported", reason: "native-module" };
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    return { status: "cancelled" };
  } catch {
    return { status: "failed", reason: "cancel-failed" };
  }
}

export async function cancelScheduledNotifications(
  identifiers: Array<string | null | undefined>,
) {
  const uniqueIds = [
    ...new Set(
      identifiers.filter(
        (identifier): identifier is string =>
          typeof identifier === "string" && Boolean(identifier.trim()),
      ),
    ),
  ];
  if (uniqueIds.length === 0) {
    return { cancelledIds: [] as string[], failedIds: [] as string[] };
  }
  if (IS_EXPO_GO) {
    return { cancelledIds: [] as string[], failedIds: uniqueIds };
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return { cancelledIds: [] as string[], failedIds: uniqueIds };
  }
  const cancelledIds: string[] = [];
  const failedIds: string[] = [];
  for (const identifier of uniqueIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      cancelledIds.push(identifier);
    } catch {
      failedIds.push(identifier);
    }
  }
  return { cancelledIds, failedIds };
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  if (IS_EXPO_GO) return [];
  const Notifications = await getNotifications();
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function getLastNotificationResponseUrl() {
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  const url = notificationResponseToUrl(
    Notifications.getLastNotificationResponse(),
  );
  if (url) {
    await Notifications.clearLastNotificationResponseAsync().catch(
      () => undefined,
    );
  }
  return url;
}

export function subscribeNotificationResponseUrls(
  listener: (url: string) => void,
) {
  let active = true;
  let removeSubscription: (() => void) | null = null;
  void getNotifications().then((Notifications) => {
    if (!active || !Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = notificationResponseToUrl(response);
        if (url) listener(url);
      },
    );
    removeSubscription = () => subscription.remove();
  });

  return () => {
    active = false;
    removeSubscription?.();
  };
}

// ─── Test helper (dev only) ──────────────────────────────────────────────────

/**
 * Fire a local notification after `delaySeconds` so we can verify the push
 * pipeline end-to-end on a real device. Requires a development build —
 * Expo Go (SDK 53+) removed expo-notifications native support entirely, so
 * even local scheduling returns null there.
 * Returns the scheduled notification id, or null on failure.
 */
export async function scheduleTestNotification(
  delaySeconds = 10,
  groupBuyId?: string,
): Promise<string | null> {
  if (IS_EXPO_GO) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  const url = groupBuyId ? buildGroupBuyNotificationUrl(groupBuyId) : null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🛎 푸시 테스트",
      body: `${delaySeconds}초 뒤 알림이 울렸어요! 푸시가 정상 동작합니다.`,
      data: url
        ? { groupBuyId, notificationType: "general", test: true, url }
        : { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
    },
  });
  return id;
}
