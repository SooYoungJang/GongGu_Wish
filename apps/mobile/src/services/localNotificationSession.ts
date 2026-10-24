import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  cancelAllScheduledNotifications,
  cancelScheduledNotifications,
  type GroupBuyAlertState,
} from "./notifications";

const nativeScheduleOperations = new Set<Promise<GroupBuyAlertState>>();
const storageOperations = new Set<Promise<void>>();
const scheduleCleanupListeners = new Set<() => void>();
const signOutFailureListeners = new Set<(namespace: string) => Promise<void>>();
const NOTIFICATION_STORAGE_PREFIX = "@gonggu/notifications/v2/";
const inactiveNamespaces = new Set<string>();
let scheduleRevision = 0;
let pausedSchedules = 0;

export function notificationStorageKey(namespace: string) {
  return `${NOTIFICATION_STORAGE_PREFIX}${encodeURIComponent(namespace)}`;
}

export function getUnscheduledEnabledState(): GroupBuyAlertState {
  return {
    status: "enabled",
    notificationId: null,
    scheduledFor: null,
    notificationIds: [],
    scheduledForDates: [],
  };
}

export function resumeLocalNotificationSchedules(namespace: string) {
  if (pausedSchedules === 0) inactiveNamespaces.delete(namespace);
}

export function captureLocalNotificationScheduleGuard(namespace: string) {
  const revision = scheduleRevision;
  return () => revision === scheduleRevision && pausedSchedules === 0 && !inactiveNamespaces.has(namespace);
}

/** Track only local writes; a stalled remote refresh must not block logout. */
export async function runLocalNotificationWrite(
  isCurrent: () => boolean,
  write: () => Promise<void>,
): Promise<void> {
  if (!isCurrent()) return;
  const operation = write();
  storageOperations.add(operation);
  try {
    await operation;
  } finally {
    storageOperations.delete(operation);
  }
}

export function onLocalNotificationSchedulesCleared(listener: () => void) {
  scheduleCleanupListeners.add(listener);
  return () => { scheduleCleanupListeners.delete(listener); };
}

export function onLocalNotificationSignOutFailed(listener: (namespace: string) => Promise<void>) {
  signOutFailureListeners.add(listener);
  return () => { signOutFailureListeners.delete(listener); };
}

export async function runLocalNotificationSchedule(
  namespace: string,
  schedule: () => Promise<GroupBuyAlertState>,
): Promise<GroupBuyAlertState> {
  if (pausedSchedules > 0 || inactiveNamespaces.has(namespace)) {
    return getUnscheduledEnabledState();
  }
  const revision = scheduleRevision;
  const operation = (async () => {
    const state = await schedule();
    if (revision === scheduleRevision) return state;
    const ids = state.status === "enabled" || state.status === "failed"
      ? [...(state.notificationIds ?? []), state.notificationId]
      : [];
    const cancellation = await cancelScheduledNotifications(ids);
    if (cancellation.failedIds.length > 0) {
      return {
        status: "failed",
        action: "disable",
        reason: "cancel-failed",
        retryable: true,
        notificationIds: cancellation.failedIds,
      } as const;
    }
    return getUnscheduledEnabledState();
  })();
  nativeScheduleOperations.add(operation);
  try {
    return await operation;
  } finally {
    nativeScheduleOperations.delete(operation);
  }
}

async function clearStoredScheduleIds(key: string) {
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return;
  // Corrupt metadata must not make signing out impossible; the normal store
  // hydration already treats unreadable entries as empty.
  let entries: unknown;
  try { entries = JSON.parse(stored); } catch { return; }
  if (!Array.isArray(entries)) return;
  const state = getUnscheduledEnabledState();
  const next = entries.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") return entry;
    return {
      ...entry,
      notificationId: null,
      scheduledFor: null,
      notificationIds: [],
      scheduledForDates: [],
      alertState: state,
    };
  });
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

/** Release this device's alarms without deleting account reminder choices. */
export async function signOutLocalNotifications<T>(
  userId: string | undefined,
  signOut: () => Promise<T>,
): Promise<T> {
  if (!userId) return signOut();
  const namespace = `user:${userId}`;
  scheduleRevision += 1;
  pausedSchedules += 1;
  inactiveNamespaces.add(namespace);
  try {
    await Promise.allSettled([...nativeScheduleOperations, ...storageOperations]);
    await cancelAllScheduledNotifications();
    scheduleCleanupListeners.forEach((listener) => listener());
    // OS cancellation affects every account's alarms on this installation.
    // Clear legacy IDs too so another account can restore its reminders later.
    const keys = await AsyncStorage.getAllKeys();
    for (const key of keys) {
      if (key.startsWith(NOTIFICATION_STORAGE_PREFIX)) await clearStoredScheduleIds(key);
    }
    return await signOut();
  } catch (error) {
    // The session stays active, but its old operations remain invalidated.
    // Recover local pending state before allowing new reminder work.
    await Promise.allSettled([...signOutFailureListeners].map((listener) => listener(namespace)));
    inactiveNamespaces.delete(namespace);
    throw error;
  } finally {
    pausedSchedules -= 1;
  }
}
