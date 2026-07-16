import type { NotificationTriggerInput } from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { callEdgeFunction } from "../lib/postgrest-client";
import { isExpoPushToken } from "./pushToken";

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
        shouldShowAlert: true,
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

async function getNotificationAvailability(): Promise<NotificationAvailability> {
  if (IS_EXPO_GO) return { status: "unsupported", reason: "expo-go" };

  const Notifications = await getNotifications();
  if (!Notifications) return { status: "unsupported", reason: "native-module" };

  try {
    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    const currentStatus = (existingStatus as { status?: string }).status;
    if (currentStatus !== "granted") {
      finalStatus = await Notifications.requestPermissionsAsync();
    }

    const finalStatusValue = (finalStatus as { status?: string }).status;
    if (finalStatusValue !== "granted") {
      return { status: "unavailable", reason: "permission-denied" };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("group-buy-start", {
        name: "공구 시작 알림",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F0445E",
      }).catch(() => {});
    }
    return { status: "available" };
  } catch {
    return { status: "unavailable", reason: "permission-request-failed" };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  return (await getNotificationAvailability()).status === "available";
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
): Promise<string | null> {
  if (IS_EXPO_GO) return null;

  try {
    const projectId = getEasProjectId();
    if (!projectId || !(await requestNotificationPermissions())) return null;

    const Notifications = await getNotifications();
    if (!Notifications) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    if (!isExpoPushToken(token)) return null;

    await callEdgeFunction(
      "register-push-token",
      { token, provider: "expo" },
      { authToken },
    );
    return token;
  } catch {
    return null;
  }
}

export type ScheduledNotification = {
  id: string;
  groupBuyId: string;
  productName: string | null;
  triggerDate: Date | null;
};

export type GroupBuyAlertState =
  | { status: "idle" }
  | { status: "pending"; action: "enable" | "disable" }
  | {
      status: "enabled";
      notificationId: string | null;
      scheduledFor: string | null;
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
    }
  | { status: "unsupported"; reason: "expo-go" | "native-module" }
  | { status: "unavailable"; reason: GroupBuyStartUnavailableReason };

export async function scheduleGroupBuyStart(
  groupBuyId: string,
  productName: string | null,
  startDate: string | null,
): Promise<ScheduleGroupBuyStartResult> {
  if (!groupBuyId.trim()) {
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
        data: { groupBuyId },
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
        groupBuyId,
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
): Promise<string | null> {
  if (IS_EXPO_GO) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🛎 푸시 테스트",
      body: `${delaySeconds}초 뒤 알림이 울렸어요! 푸시가 정상 동작합니다.`,
      data: { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
    },
  });
  return id;
}
