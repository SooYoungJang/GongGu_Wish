import AsyncStorage from "@react-native-async-storage/async-storage";

import { callEdgeFunction } from "../lib/postgrest-client";

export const NOTIFICATION_REMINDER_DAYS = [1, 3, 7] as const;
export type NotificationReminderDay =
  (typeof NOTIFICATION_REMINDER_DAYS)[number];

export type NotificationPreferences = {
  pushEnabled: boolean;
  deadlineRemindersEnabled: boolean;
  newSubmissionsEnabled: boolean;
  reminderDays: NotificationReminderDay[];
  followedInfluencers: string[];
  followedBrands: string[];
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  deadlineRemindersEnabled: false,
  newSubmissionsEnabled: false,
  reminderDays: [1, 3, 7],
  followedInfluencers: [],
  followedBrands: [],
};

const STORAGE_PREFIX = "@gonggu/notification-preferences/v1";
const REMOTE_TIMEOUT_MS = 10_000;
const MAX_FOLLOW_TARGETS = 50;
const MAX_FOLLOW_TARGET_LENGTH = 80;
const INFLUENCER_PATTERN = /^[a-z0-9._]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeReminderDays(value: unknown): NotificationReminderDay[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_NOTIFICATION_PREFERENCES.reminderDays];
  }

  const allowed = new Set<number>(NOTIFICATION_REMINDER_DAYS);
  const normalized = [
    ...new Set(
      value.filter(
        (day): day is NotificationReminderDay =>
          typeof day === "number" && allowed.has(day),
      ),
    ),
  ].sort((left, right) => left - right);
  return normalized.length > 0
    ? normalized
    : [...DEFAULT_NOTIFICATION_PREFERENCES.reminderDays];
}

function normalizeFollowTargets(
  value: unknown,
  kind: "brand" | "influencer",
): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const compact = candidate.trim().replace(/\s+/g, " ");
    const display =
      kind === "influencer"
        ? compact.replace(/^@+/, "").toLowerCase()
        : compact;
    if (
      !display ||
      display.length > MAX_FOLLOW_TARGET_LENGTH ||
      (kind === "influencer" && !INFLUENCER_PATTERN.test(display))
    ) {
      continue;
    }

    const identity = display.toLocaleLowerCase("en-US");
    if (seen.has(identity)) continue;
    seen.add(identity);
    normalized.push(display);
    if (normalized.length >= MAX_FOLLOW_TARGETS) break;
  }
  return normalized;
}

export function normalizeNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const source = isRecord(value) ? value : {};
  return {
    pushEnabled:
      typeof source.pushEnabled === "boolean"
        ? source.pushEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
    deadlineRemindersEnabled:
      typeof source.deadlineRemindersEnabled === "boolean"
        ? source.deadlineRemindersEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.deadlineRemindersEnabled,
    newSubmissionsEnabled:
      typeof source.newSubmissionsEnabled === "boolean"
        ? source.newSubmissionsEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.newSubmissionsEnabled,
    reminderDays: normalizeReminderDays(source.reminderDays),
    followedInfluencers: normalizeFollowTargets(
      source.followedInfluencers,
      "influencer",
    ),
    followedBrands: normalizeFollowTargets(source.followedBrands, "brand"),
  };
}

export function getNotificationPreferencesStorageKey(namespace: string) {
  return `${STORAGE_PREFIX}/${encodeURIComponent(namespace || "guest")}`;
}

export function getPendingNotificationPreferencesStorageKey(namespace: string) {
  return `${getNotificationPreferencesStorageKey(namespace)}/pending`;
}

export async function loadNotificationPreferences(namespace: string) {
  try {
    const raw = await AsyncStorage.getItem(
      getNotificationPreferencesStorageKey(namespace),
    );
    return normalizeNotificationPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeNotificationPreferences(null);
  }
}

export async function saveNotificationPreferences(
  namespace: string,
  preferences: NotificationPreferences,
) {
  const normalized = normalizeNotificationPreferences(preferences);
  await AsyncStorage.setItem(
    getNotificationPreferencesStorageKey(namespace),
    JSON.stringify(normalized),
  );
  return normalized;
}

export async function loadPendingNotificationPreferences(namespace: string) {
  try {
    const raw = await AsyncStorage.getItem(
      getPendingNotificationPreferencesStorageKey(namespace),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? normalizeNotificationPreferences(parsed) : null;
  } catch {
    return null;
  }
}

export async function savePendingNotificationPreferences(
  namespace: string,
  preferences: NotificationPreferences,
) {
  const normalized = normalizeNotificationPreferences(preferences);
  await AsyncStorage.setItem(
    getPendingNotificationPreferencesStorageKey(namespace),
    JSON.stringify(normalized),
  );
  return normalized;
}

export async function clearPendingNotificationPreferences(namespace: string) {
  await AsyncStorage.removeItem(
    getPendingNotificationPreferencesStorageKey(namespace),
  );
}

async function callNotificationPreferencesEdge<T>(
  authToken: string,
  body: unknown,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    return await callEdgeFunction<T>("register-push-token", body, {
      authToken,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncNotificationPreferences(
  authToken: string,
  preferences: NotificationPreferences,
) {
  const normalized = normalizeNotificationPreferences(preferences);
  return callNotificationPreferencesEdge<{
    data: { preferencesSynced: boolean; registered: boolean };
  }>(authToken, { preferences: normalized });
}

export async function loadRemoteNotificationPreferences(authToken: string) {
  const response = await callNotificationPreferencesEdge<{
    data: { preferences: NotificationPreferences };
  }>(authToken, { action: "read" });
  return normalizeNotificationPreferences(response.data.preferences);
}
