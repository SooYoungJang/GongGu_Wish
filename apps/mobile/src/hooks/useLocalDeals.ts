import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGroupBuysByIds, syncNotification } from "../api";
import { useOptionalAuth } from "../context/AuthContext";
import type { GroupBuyAlertState } from "../services/notifications";
import {
  cancelScheduledNotifications,
  scheduleGroupBuyReminders,
  scheduleGroupBuyStart,
} from "../services/notifications";
import { useNotificationPreferences } from "../context/NotificationPreferencesContext";
import {
  getPendingNotificationPreferencesStorageKey,
  getNotificationPreferencesStorageKey,
  type NotificationPreferences,
} from "../services/notificationPreferences";
import type { GroupBuy } from "../types";

const BOOKMARK_KEY = "@gonggu/bookmarks/v1";
const RECENT_KEY = "@gonggu/recent-views/v1";
const NOTI_KEY = "@gonggu/notifications/v1";
const NOTI_KEY_PREFIX = "@gonggu/notifications/v2";
const NOTI_OUTBOX_PREFIX = "@gonggu/notifications/outbox/v1";
const WISH_ITEM_KEY = "@gonggu/wish-items/v1";
const GUEST_NAMESPACE = "guest";
const MAX_RECENT = 10;
const MAX_WISH_ITEMS = 50;

export type StoredGroupBuy = Pick<
  GroupBuy,
  | "id"
  | "productName"
  | "brandName"
  | "category"
  | "startDate"
  | "endDate"
  | "purchaseUrl"
  | "discountInfo"
  | "summary"
  | "confidence"
  | "priceKrw"
  | "thumbnailUrl"
  | "videoUrl"
  | "mediaUrls"
  | "mediaItems"
  | "mediaType"
  | "rawPost"
>;

export type NotificationEntry = {
  groupBuyId: string;
  productName: string | null;
  // Legacy AsyncStorage entries may not have a price yet.
  priceKrw?: number | null;
  brandName?: string | null;
  category?: GroupBuy["category"];
  endDate: string | null;
  startDate: string | null;
  purchaseUrl?: string | null;
  discountInfo?: string | null;
  summary?: string | null;
  confidence?: number;
  thumbnailUrl: string | null;
  videoUrl?: string | null;
  mediaUrls?: string[];
  mediaItems?: GroupBuy["mediaItems"];
  mediaType?: GroupBuy["mediaType"];
  rawPost?: GroupBuy["rawPost"];
  alertState?: GroupBuyAlertState;
  mirrorStatus?: "pending" | "synced" | "failed";
  scheduledFor: string | null;
  notificationId: string | null;
  scheduledForDates?: string[];
  notificationIds?: string[];
  createdAt: string;
};

type NotificationDealFields = Pick<
  NotificationEntry,
  | "productName"
  | "priceKrw"
  | "brandName"
  | "category"
  | "endDate"
  | "startDate"
  | "purchaseUrl"
  | "discountInfo"
  | "summary"
  | "confidence"
  | "thumbnailUrl"
  | "videoUrl"
  | "mediaUrls"
  | "mediaItems"
  | "mediaType"
  | "rawPost"
>;

type NotificationListener = (entries: NotificationEntry[]) => void;
type NotificationMirrorEntry = {
  groupBuyId: string;
  enabled: boolean;
  updatedAt: string;
};

const notificationListeners = new Map<string, Set<NotificationListener>>();
const notificationSnapshots = new Map<string, NotificationEntry[]>();
const notificationOperations = new Map<string, Promise<unknown>>();
const notificationFlushes = new Map<string, Promise<void>>();

function notificationStorageKey(namespace: string) {
  return `${NOTI_KEY_PREFIX}/${encodeURIComponent(namespace)}`;
}

function notificationOutboxKey(namespace: string) {
  return `${NOTI_OUTBOX_PREFIX}/${encodeURIComponent(namespace)}`;
}

function getNotificationSnapshot(namespace: string) {
  return notificationSnapshots.get(namespace) ?? [];
}

function getNotificationListeners(namespace: string) {
  const listeners = notificationListeners.get(namespace);
  if (listeners) return listeners;
  const next = new Set<NotificationListener>();
  notificationListeners.set(namespace, next);
  return next;
}

function publishNotifications(namespace: string, entries: NotificationEntry[]) {
  notificationSnapshots.set(namespace, entries);
  getNotificationListeners(namespace).forEach((listener) => listener(entries));
}

function getDerivedAlertState(entry: NotificationEntry): GroupBuyAlertState {
  if (entry.alertState) return entry.alertState;
  if (
    entry.notificationId ||
    entry.scheduledFor ||
    entry.notificationIds?.length ||
    entry.scheduledForDates?.length
  ) {
    return {
      status: "enabled",
      notificationId: entry.notificationId,
      scheduledFor: entry.scheduledFor,
      notificationIds: entry.notificationIds,
      scheduledForDates: entry.scheduledForDates,
    };
  }
  return { status: "unavailable", reason: "missing-start-date" };
}

function normalizeNotificationEntry(
  entry: NotificationEntry,
): NotificationEntry {
  return entry.alertState
    ? entry
    : { ...entry, alertState: getDerivedAlertState(entry) };
}

function enqueueNotificationOperation<T>(
  namespace: string,
  _groupBuyId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = namespace;
  const previous = notificationOperations.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  const tracked = next.finally(() => {
    if (notificationOperations.get(key) === tracked) {
      notificationOperations.delete(key);
    }
  });
  notificationOperations.set(key, tracked);
  return next;
}

export type WishItemEntry = {
  id: string;
  groupBuyId: string | null;
  submissionId: string | null;
  instagramUrl: string;
  productName: string | null;
  thumbnailUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | null;
  createdAt: string;
};

function toStored(item: GroupBuy): StoredGroupBuy {
  return {
    id: item.id,
    productName: item.productName,
    brandName: item.brandName,
    category: item.category,
    startDate: item.startDate,
    summary: item.summary,
    confidence: item.confidence,
    priceKrw: item.priceKrw,
    thumbnailUrl: item.thumbnailUrl,
    videoUrl: item.videoUrl,
    mediaUrls: item.mediaUrls,
    mediaItems: item.mediaItems,
    mediaType: item.mediaType,
    endDate: item.endDate,
    discountInfo: item.discountInfo,
    purchaseUrl: item.purchaseUrl,
    rawPost: item.rawPost,
  };
}

function toNotificationDealFields(item: GroupBuy): NotificationDealFields {
  return {
    productName: item.productName,
    priceKrw: item.priceKrw ?? null,
    brandName: item.brandName,
    category: item.category,
    endDate: item.endDate,
    startDate: item.startDate,
    purchaseUrl: item.purchaseUrl,
    discountInfo: item.discountInfo,
    summary: item.summary,
    confidence: item.confidence,
    thumbnailUrl: item.thumbnailUrl,
    videoUrl: item.videoUrl,
    mediaUrls: item.mediaUrls,
    mediaItems: item.mediaItems,
    mediaType: item.mediaType,
    rawPost: item.rawPost,
  };
}

function mergeRecentViews(
  newest: StoredGroupBuy[],
  existing: StoredGroupBuy[],
): StoredGroupBuy[] {
  const seen = new Set<string>();
  const merged: StoredGroupBuy[] = [];

  for (const item of [...newest, ...existing]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    if (merged.length === MAX_RECENT) break;
  }

  return merged;
}

function hasSameRecentViewOrder(
  left: StoredGroupBuy[],
  right: StoredGroupBuy[],
) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.id === right[index]?.id)
  );
}

function needsStoredDealHydration(item: StoredGroupBuy) {
  return (
    item.priceKrw === undefined ||
    item.discountInfo === undefined ||
    item.brandName === undefined ||
    item.category === undefined ||
    item.rawPost === undefined
  );
}

async function hydrateStoredDeals(
  key: string,
  items: StoredGroupBuy[],
): Promise<StoredGroupBuy[]> {
  const ids = [
    ...new Set(items.filter(needsStoredDealHydration).map((item) => item.id)),
  ];
  if (ids.length === 0) return items;

  const freshDeals = await fetchGroupBuysByIds(ids);
  const freshById = new Map(freshDeals.map((item) => [item.id, item]));
  const next = items.map((item) => {
    const fresh = freshById.get(item.id);
    return fresh ? toStored(fresh) : item;
  });

  if (next.some((item, index) => item !== items[index])) {
    await writeJSON(key, next);
  }
  return next;
}

function needsNotificationHydration(entry: NotificationEntry) {
  return (
    entry.priceKrw === undefined ||
    entry.brandName === undefined ||
    entry.category === undefined ||
    entry.purchaseUrl === undefined ||
    entry.discountInfo === undefined ||
    entry.summary === undefined ||
    entry.confidence === undefined ||
    entry.videoUrl === undefined ||
    entry.mediaUrls === undefined ||
    entry.mediaType === undefined ||
    entry.rawPost === undefined
  );
}

async function hydrateNotificationEntries(
  entries: NotificationEntry[],
  storageKey: string,
): Promise<NotificationEntry[]> {
  const normalizedEntries = entries.map(normalizeNotificationEntry);
  const ids = [
    ...new Set(
      normalizedEntries
        .filter(needsNotificationHydration)
        .map((entry) => entry.groupBuyId),
    ),
  ];
  if (ids.length === 0) {
    if (normalizedEntries.some((entry, index) => entry !== entries[index])) {
      await writeJSON(storageKey, normalizedEntries);
    }
    return normalizedEntries;
  }

  const freshDeals = await fetchGroupBuysByIds(ids);
  const freshById = new Map(freshDeals.map((item) => [item.id, item]));
  const next = normalizedEntries.map((entry) => {
    const fresh = freshById.get(entry.groupBuyId);
    return fresh ? { ...entry, ...toNotificationDealFields(fresh) } : entry;
  });

  if (next.some((entry, index) => entry !== normalizedEntries[index])) {
    await writeJSON(storageKey, next);
  }
  return next;
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

type RecentViewsListener = (entries: StoredGroupBuy[]) => void;
type PendingRecentView = {
  sequence: number;
  item: StoredGroupBuy;
};

const recentViewsListeners = new Set<RecentViewsListener>();
let recentViewsSnapshot: StoredGroupBuy[] = [];
let recentViewsOperation: Promise<unknown> = Promise.resolve();
let pendingRecentViews: PendingRecentView[] = [];
let nextRecentViewSequence = 0;

function getRecentViewsSnapshot() {
  return recentViewsSnapshot;
}

function getPendingRecentViewItems(entries = pendingRecentViews) {
  return mergeRecentViews(
    entries.map((entry) => entry.item),
    [],
  );
}

function publishRecentViews(entries: StoredGroupBuy[]) {
  recentViewsSnapshot = entries;
  recentViewsListeners.forEach((listener) => listener(entries));
}

function subscribeRecentViews(listener: RecentViewsListener) {
  recentViewsListeners.add(listener);
  return () => {
    recentViewsListeners.delete(listener);
  };
}

function enqueueRecentViewsOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const next = recentViewsOperation.catch(() => undefined).then(operation);
  recentViewsOperation = next;
  return next;
}

async function readRecentViewsStorage(): Promise<StoredGroupBuy[] | null> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredGroupBuy[]) : null;
  } catch {
    return null;
  }
}

async function writeRecentViewsStorage(entries: StoredGroupBuy[]) {
  try {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

async function reconcileRecentViews(
  hydrate: boolean,
): Promise<StoredGroupBuy[]> {
  const stored = await readRecentViewsStorage();
  if (!stored) {
    const visible = mergeRecentViews(
      getPendingRecentViewItems(),
      recentViewsSnapshot,
    );
    publishRecentViews(visible);
    return visible;
  }

  const normalized = mergeRecentViews([], stored);
  let hydrated = normalized;
  if (hydrate) {
    try {
      hydrated = await hydrateStoredDeals(RECENT_KEY, normalized);
    } catch {
      // Keep locally stored history when server-side enrichment is unavailable.
    }
  }

  const pendingAtWrite = [...pendingRecentViews];
  const next = mergeRecentViews(
    getPendingRecentViewItems(pendingAtWrite),
    hydrated,
  );
  const shouldWrite =
    pendingAtWrite.length > 0 || !hasSameRecentViewOrder(stored, next);
  if (shouldWrite) {
    const wrote = await writeRecentViewsStorage(next);
    if (!wrote) {
      const visible = mergeRecentViews(
        getPendingRecentViewItems(),
        recentViewsSnapshot,
      );
      publishRecentViews(visible);
      return visible;
    }

    const persistedSequences = new Set(
      pendingAtWrite.map((entry) => entry.sequence),
    );
    pendingRecentViews = pendingRecentViews.filter(
      (entry) => !persistedSequences.has(entry.sequence),
    );
  }

  const visible = mergeRecentViews(getPendingRecentViewItems(), next);
  publishRecentViews(visible);
  return visible;
}

function refreshRecentViewsStore(): Promise<StoredGroupBuy[]> {
  return enqueueRecentViewsOperation(() => reconcileRecentViews(true));
}

function recordRecentViewStore(
  item: StoredGroupBuy,
): Promise<StoredGroupBuy[]> {
  pendingRecentViews = [
    { sequence: ++nextRecentViewSequence, item },
    ...pendingRecentViews,
  ];
  publishRecentViews(
    mergeRecentViews(getPendingRecentViewItems(), recentViewsSnapshot),
  );

  return enqueueRecentViewsOperation(() => reconcileRecentViews(false));
}

function clearRecentViewsStore(): Promise<void> {
  const clearThroughSequence = nextRecentViewSequence;

  return enqueueRecentViewsOperation(async () => {
    try {
      await AsyncStorage.removeItem(RECENT_KEY);
    } catch {
      // Local storage cleanup is best-effort after the server deletion.
    }
    pendingRecentViews = pendingRecentViews.filter(
      (entry) => entry.sequence > clearThroughSequence,
    );
    publishRecentViews(getPendingRecentViewItems());
  });
}

async function readNotificationEntries(
  namespace: string,
  storageKey: string,
): Promise<NotificationEntry[]> {
  const stored = await readJSON<NotificationEntry[] | null>(storageKey, null);
  if (Array.isArray(stored)) return stored;

  const legacy =
    namespace === GUEST_NAMESPACE
      ? await readJSON<NotificationEntry[]>(NOTI_KEY, [])
      : [];
  if (legacy.length > 0) await writeJSON(storageKey, legacy);
  return legacy;
}

async function flushNotificationMirror(namespace: string): Promise<void> {
  const existing = notificationFlushes.get(namespace);
  if (existing) return existing;

  const flush = (async () => {
    const key = notificationOutboxKey(namespace);
    const pending = await readJSON<NotificationMirrorEntry[]>(key, []);
    const remaining: NotificationMirrorEntry[] = [];

    for (const entry of pending) {
      try {
        const result = await syncNotification(entry.groupBuyId, entry.enabled);
        if (result === false) remaining.push(entry);
      } catch {
        remaining.push(entry);
      }
    }

    await writeJSON(key, remaining);
  })();

  notificationFlushes.set(namespace, flush);
  try {
    await flush;
  } finally {
    if (notificationFlushes.get(namespace) === flush) {
      notificationFlushes.delete(namespace);
    }
  }
}

async function enqueueNotificationMirror(
  namespace: string,
  groupBuyId: string,
  enabled: boolean,
): Promise<void> {
  const key = notificationOutboxKey(namespace);
  const activeFlush = notificationFlushes.get(namespace);
  if (activeFlush) await activeFlush.catch(() => undefined);
  const pending = await readJSON<NotificationMirrorEntry[]>(key, []);
  const next = [
    ...pending.filter((entry) => entry.groupBuyId !== groupBuyId),
    { groupBuyId, enabled, updatedAt: new Date().toISOString() },
  ];
  await writeJSON(key, next);
  void flushNotificationMirror(namespace);
}

async function persistNotifications(
  namespace: string,
  storageKey: string,
  entries: NotificationEntry[],
): Promise<void> {
  await writeJSON(storageKey, entries);
  publishNotifications(namespace, entries);
}

function alertStateFromScheduleResult(
  result: Awaited<ReturnType<typeof scheduleGroupBuyStart>>,
): GroupBuyAlertState {
  switch (result.status) {
    case "scheduled":
      return {
        status: "enabled",
        notificationId: result.notification.id,
        scheduledFor: result.notification.triggerDate?.toISOString() ?? null,
      };
    case "unsupported":
      return result;
    case "unavailable":
      return result;
    case "failed":
      return {
        status: "failed",
        action: "enable",
        reason: result.reason,
        retryable: result.reason !== "invalid-group-buy-id",
      };
  }
}

function alertStateFromReminderResult(
  result: Awaited<ReturnType<typeof scheduleGroupBuyReminders>>,
): GroupBuyAlertState {
  switch (result.status) {
    case "scheduled": {
      const notificationIds = result.notifications.map((item) => item.id);
      const scheduledForDates = result.notifications
        .map((item) => item.triggerDate?.toISOString() ?? null)
        .filter((value): value is string => Boolean(value));
      return {
        status: "enabled",
        notificationId: notificationIds[0] ?? null,
        scheduledFor: scheduledForDates[0] ?? null,
        notificationIds,
        scheduledForDates,
      };
    }
    case "unsupported":
      return result;
    case "unavailable":
      return result;
    case "failed": {
      const notificationIds = (result.notifications ?? []).map(
        (item) => item.id,
      );
      const scheduledForDates = (result.notifications ?? [])
        .map((item) => item.triggerDate?.toISOString() ?? null)
        .filter((value): value is string => Boolean(value));
      return {
        status: "failed",
        action: "enable",
        reason: result.reason,
        retryable: result.reason !== "invalid-group-buy-id",
        notificationId: notificationIds[0] ?? null,
        scheduledFor: scheduledForDates[0] ?? null,
        notificationIds,
        scheduledForDates,
      };
    }
  }
}

function getEntryNotificationIds(entry: NotificationEntry) {
  return [
    ...new Set(
      [entry.notificationId, ...(entry.notificationIds ?? [])].filter(
        (identifier): identifier is string => Boolean(identifier),
      ),
    ),
  ];
}

function getUnscheduledEnabledState(): GroupBuyAlertState {
  return {
    status: "enabled",
    notificationId: null,
    scheduledFor: null,
    notificationIds: [],
    scheduledForDates: [],
  };
}

async function getScheduledAlertState(
  item: GroupBuy,
  preferences: NotificationPreferences,
): Promise<GroupBuyAlertState> {
  if (
    !preferences.pushEnabled ||
    !preferences.deadlineRemindersEnabled ||
    preferences.reminderDays.length === 0
  ) {
    return getUnscheduledEnabledState();
  }
  if (item.endDate) {
    return alertStateFromReminderResult(
      await scheduleGroupBuyReminders(
        item.id,
        item.productName,
        item.endDate,
        preferences.reminderDays,
      ),
    );
  }
  return alertStateFromScheduleResult(
    await scheduleGroupBuyStart(item.id, item.productName, item.startDate),
  );
}

function applyAlertState(
  entry: NotificationEntry,
  alertState: GroupBuyAlertState,
): NotificationEntry {
  const hasScheduleMetadata =
    alertState.status === "enabled" || alertState.status === "failed";
  return {
    ...entry,
    scheduledFor: hasScheduleMetadata
      ? (alertState.scheduledFor ?? null)
      : null,
    notificationId: hasScheduleMetadata
      ? (alertState.notificationId ?? null)
      : null,
    scheduledForDates: hasScheduleMetadata
      ? (alertState.scheduledForDates ?? [])
      : [],
    notificationIds: hasScheduleMetadata
      ? (alertState.notificationIds ?? [])
      : [],
    alertState,
  };
}

function retainFailedNotificationIds(
  entry: NotificationEntry,
  failedIds: string[],
  alertState: Extract<GroupBuyAlertState, { status: "failed" }>,
) {
  const dateById = new Map<string, string>();
  if (entry.notificationId && entry.scheduledFor) {
    dateById.set(entry.notificationId, entry.scheduledFor);
  }
  (entry.notificationIds ?? []).forEach((identifier, index) => {
    const scheduledFor = entry.scheduledForDates?.[index];
    if (scheduledFor) dateById.set(identifier, scheduledFor);
  });
  const notificationIds = [...new Set(failedIds)];
  const scheduledForDates = notificationIds
    .map((identifier) => dateById.get(identifier) ?? null)
    .filter((value): value is string => Boolean(value));
  const notificationId = notificationIds[0] ?? null;
  const scheduledFor = notificationId
    ? (dateById.get(notificationId) ?? null)
    : null;
  return {
    ...entry,
    notificationId,
    scheduledFor,
    notificationIds,
    scheduledForDates,
    alertState: {
      ...alertState,
      notificationId,
      scheduledFor,
      notificationIds,
      scheduledForDates,
    },
  };
}

function notificationEntryToGroupBuy(entry: NotificationEntry): GroupBuy {
  return {
    id: entry.groupBuyId,
    productName: entry.productName,
    priceKrw: entry.priceKrw ?? null,
    brandName: entry.brandName ?? null,
    category: entry.category ?? null,
    startDate: entry.startDate,
    endDate: entry.endDate,
    purchaseUrl: entry.purchaseUrl ?? null,
    discountInfo: entry.discountInfo ?? null,
    summary: entry.summary ?? null,
    confidence: entry.confidence ?? 0,
    thumbnailUrl: entry.thumbnailUrl,
    videoUrl: entry.videoUrl ?? null,
    mediaUrls: entry.mediaUrls ?? [],
    mediaItems: entry.mediaItems,
    mediaType: entry.mediaType ?? null,
    rawPost: entry.rawPost ?? {
      postUrl: entry.purchaseUrl ?? "",
      influencer: { instagramUsername: "" },
    },
  };
}

async function enableNotification(
  namespace: string,
  storageKey: string,
  current: NotificationEntry[],
  item: GroupBuy,
  preferences: NotificationPreferences,
): Promise<GroupBuyAlertState> {
  const pendingEntry: NotificationEntry = {
    groupBuyId: item.id,
    ...toNotificationDealFields(item),
    scheduledFor: null,
    notificationId: null,
    scheduledForDates: [],
    notificationIds: [],
    alertState: { status: "pending", action: "enable" },
    mirrorStatus: "pending",
    createdAt: new Date().toISOString(),
  };
  const withoutExisting = current.filter(
    (entry) => entry.groupBuyId !== item.id,
  );
  await persistNotifications(namespace, storageKey, [
    pendingEntry,
    ...withoutExisting,
  ]);

  const alertState = await getScheduledAlertState(item, preferences);
  const completedEntry = applyAlertState(pendingEntry, alertState);
  await persistNotifications(namespace, storageKey, [
    completedEntry,
    ...withoutExisting,
  ]);
  await enqueueNotificationMirror(namespace, item.id, true);
  return alertState;
}

async function disableNotification(
  namespace: string,
  storageKey: string,
  current: NotificationEntry[],
  existing: NotificationEntry,
): Promise<GroupBuyAlertState> {
  const pendingEntry: NotificationEntry = {
    ...existing,
    alertState: { status: "pending", action: "disable" },
  };
  const withPending = [
    pendingEntry,
    ...current.filter((entry) => entry.groupBuyId !== existing.groupBuyId),
  ];
  await persistNotifications(namespace, storageKey, withPending);

  const notificationIds = getEntryNotificationIds(existing);
  if (notificationIds.length > 0) {
    const result = await cancelScheduledNotifications(notificationIds);
    if (result.failedIds.length > 0) {
      const failedState: GroupBuyAlertState = {
        status: "failed",
        action: "disable",
        reason: "cancel-failed",
        retryable: true,
      };
      await persistNotifications(namespace, storageKey, [
        retainFailedNotificationIds(existing, result.failedIds, failedState),
        ...current.filter((entry) => entry.groupBuyId !== existing.groupBuyId),
      ]);
      return failedState;
    }
  }

  const next = current.filter(
    (entry) => entry.groupBuyId !== existing.groupBuyId,
  );
  await persistNotifications(namespace, storageKey, next);
  await enqueueNotificationMirror(namespace, existing.groupBuyId, false);
  return { status: "idle" };
}

async function rescheduleNotification(
  namespace: string,
  storageKey: string,
  groupBuyId: string,
  preferences: NotificationPreferences,
) {
  const current = getNotificationSnapshot(namespace);
  const existing = current.find((entry) => entry.groupBuyId === groupBuyId);
  if (!existing) return { status: "idle" } as const;

  const cancellation = await cancelScheduledNotifications(
    getEntryNotificationIds(existing),
  );
  if (cancellation.failedIds.length > 0) {
    const failedState: GroupBuyAlertState = {
      status: "failed",
      action: "enable",
      reason: "cancel-failed",
      retryable: true,
    };
    const failedEntry = retainFailedNotificationIds(
      existing,
      cancellation.failedIds,
      failedState,
    );
    await persistNotifications(namespace, storageKey, [
      failedEntry,
      ...current.filter((entry) => entry.groupBuyId !== groupBuyId),
    ]);
    return failedState;
  }

  const alertState = await getScheduledAlertState(
    notificationEntryToGroupBuy(existing),
    preferences,
  );
  const nextEntry = applyAlertState(existing, alertState);
  await persistNotifications(namespace, storageKey, [
    nextEntry,
    ...current.filter((entry) => entry.groupBuyId !== groupBuyId),
  ]);
  return alertState;
}

/** Clear locally stored account activity after a successful account deletion. */
export async function clearLocalUserData(
  namespace = GUEST_NAMESPACE,
): Promise<void> {
  const storageKey = notificationStorageKey(namespace);
  const storedNotifications = await readNotificationEntries(
    namespace,
    storageKey,
  );

  await Promise.all(
    storedNotifications.map((entry) =>
      cancelScheduledNotifications(getEntryNotificationIds(entry)),
    ),
  );

  const notificationKeys = [
    storageKey,
    notificationOutboxKey(namespace),
    getNotificationPreferencesStorageKey(namespace),
    getPendingNotificationPreferencesStorageKey(namespace),
  ];
  if (namespace === GUEST_NAMESPACE) notificationKeys.push(NOTI_KEY);

  await Promise.all([
    clearRecentViewsStore(),
    ...[BOOKMARK_KEY, ...notificationKeys, WISH_ITEM_KEY].map(async (key) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Local storage cleanup is best-effort after the server deletion.
      }
    }),
  ]);
  publishNotifications(namespace, []);
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<StoredGroupBuy[]>(BOOKMARK_KEY, []).then(async (value) => {
      const hydrated = await hydrateStoredDeals(BOOKMARK_KEY, value);
      setBookmarks(hydrated);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((item) => item.id === id),
    [bookmarks],
  );

  const toggleBookmark = useCallback((item: GroupBuy) => {
    const isCurrentlyBookmarked = bookmarks.some(
      (entry) => entry.id === item.id,
    );
    setBookmarks((current) => {
      const next = current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [toStored(item), ...current];
      void writeJSON(BOOKMARK_KEY, next);
      return next;
    });
    // Mirror to server for popularity aggregation (fire-and-forget).
    void import("../api").then(({ syncBookmark }) =>
      syncBookmark(item.id, !isCurrentlyBookmarked),
    );
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((current) => {
      const next = current.filter((entry) => entry.id !== id);
      void writeJSON(BOOKMARK_KEY, next);
      return next;
    });
    void import("../api").then(({ syncBookmark }) => syncBookmark(id, false));
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refresh,
    ready,
  };
}

export function useRecentViews() {
  const [recentViews, setRecentViews] = useState<StoredGroupBuy[]>(
    getRecentViewsSnapshot,
  );
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);
  const refreshVersionRef = useRef(0);

  const refresh = useCallback(() => {
    const version = ++refreshVersionRef.current;
    setReady(false);
    void refreshRecentViewsStore().then(() => {
      if (mountedRef.current && refreshVersionRef.current === version) {
        setReady(true);
      }
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeRecentViews(setRecentViews);
    setRecentViews(getRecentViewsSnapshot());
    refresh();
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [refresh]);

  const recordView = useCallback((item: GroupBuy) => {
    void recordRecentViewStore(toStored(item));
  }, []);

  return { recentViews, recordView, refresh, ready };
}

export function useNotifications() {
  const auth = useOptionalAuth();
  const { preferences } = useNotificationPreferences();
  const namespace = auth?.user?.id ? `user:${auth.user.id}` : GUEST_NAMESPACE;
  const storageKey = notificationStorageKey(namespace);
  const [notifications, setNotifications] = useState<NotificationEntry[]>(() =>
    getNotificationSnapshot(namespace),
  );
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);
  const activeNamespaceRef = useRef(namespace);

  const refresh = useCallback(() => {
    setReady(false);
    void (async () => {
      const value = await readNotificationEntries(namespace, storageKey);
      let hydrated: NotificationEntry[];
      try {
        hydrated = await hydrateNotificationEntries(value, storageKey);
      } catch {
        hydrated = value.map(normalizeNotificationEntry);
      }
      notificationSnapshots.set(namespace, hydrated);
      if (!mountedRef.current || activeNamespaceRef.current !== namespace)
        return;
      publishNotifications(namespace, hydrated);
      setReady(true);
      await flushNotificationMirror(namespace);
    })();
  }, [namespace, storageKey]);

  useEffect(() => {
    mountedRef.current = true;
    activeNamespaceRef.current = namespace;
    const listeners = getNotificationListeners(namespace);
    listeners.add(setNotifications);
    setNotifications(getNotificationSnapshot(namespace));
    refresh();
    return () => {
      mountedRef.current = false;
      listeners.delete(setNotifications);
    };
  }, [namespace, refresh]);

  const isNotifying = useCallback(
    (id: string) => notifications.some((item) => item.groupBuyId === id),
    [notifications],
  );

  const getNotificationState = useCallback(
    (id: string): GroupBuyAlertState => {
      const entry = notifications.find((item) => item.groupBuyId === id);
      return entry ? getDerivedAlertState(entry) : { status: "idle" };
    },
    [notifications],
  );

  const toggleNotification = useCallback(
    (item: GroupBuy) =>
      enqueueNotificationOperation(namespace, item.id, async () => {
        const current = getNotificationSnapshot(namespace);
        const existing = current.find((entry) => entry.groupBuyId === item.id);
        return existing
          ? disableNotification(namespace, storageKey, current, existing)
          : enableNotification(
              namespace,
              storageKey,
              current,
              item,
              preferences,
            );
      }),
    [namespace, preferences, storageKey],
  );

  const retryNotification = useCallback(
    (item: GroupBuy) =>
      enqueueNotificationOperation(namespace, item.id, async () => {
        const current = getNotificationSnapshot(namespace);
        const existing = current.find((entry) => entry.groupBuyId === item.id);
        if (
          existing?.alertState?.status === "failed" &&
          existing.alertState.action === "disable"
        ) {
          return disableNotification(namespace, storageKey, current, existing);
        }
        if (
          existing?.alertState?.status === "failed" &&
          getEntryNotificationIds(existing).length > 0
        ) {
          return rescheduleNotification(
            namespace,
            storageKey,
            item.id,
            preferences,
          );
        }
        return enableNotification(
          namespace,
          storageKey,
          current,
          item,
          preferences,
        );
      }),
    [namespace, preferences, storageKey],
  );

  const removeNotification = useCallback(
    (groupBuyId: string) =>
      enqueueNotificationOperation(namespace, groupBuyId, async () => {
        const current = getNotificationSnapshot(namespace);
        const existing = current.find(
          (entry) => entry.groupBuyId === groupBuyId,
        );
        if (!existing) return { status: "idle" } as const;
        return disableNotification(namespace, storageKey, current, existing);
      }),
    [namespace, storageKey],
  );

  const rescheduleNotifications = useCallback(
    async (nextPreferences: NotificationPreferences) => {
      const groupBuyIds = getNotificationSnapshot(namespace).map(
        (entry) => entry.groupBuyId,
      );
      const states: GroupBuyAlertState[] = [];
      for (const groupBuyId of groupBuyIds) {
        states.push(
          await enqueueNotificationOperation(namespace, groupBuyId, () =>
            rescheduleNotification(
              namespace,
              storageKey,
              groupBuyId,
              nextPreferences,
            ),
          ),
        );
      }
      return states;
    },
    [namespace, storageKey],
  );

  return {
    notifications,
    isNotifying,
    getNotificationState,
    toggleNotification,
    retryNotification,
    removeNotification,
    rescheduleNotifications,
    refresh,
    ready,
  };
}

export function useWishItems() {
  const [wishItems, setWishItems] = useState<WishItemEntry[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<WishItemEntry[]>(WISH_ITEM_KEY, []).then((value) => {
      setWishItems(value);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordWishItem = useCallback(
    (
      entry: Omit<WishItemEntry, "id" | "createdAt"> & {
        id?: string;
        createdAt?: string;
      },
    ) => {
      setWishItems((current) => {
        const normalizedUrl = entry.instagramUrl.trim();
        const id =
          entry.id ?? entry.submissionId ?? entry.groupBuyId ?? normalizedUrl;
        const nextEntry: WishItemEntry = {
          id,
          groupBuyId: entry.groupBuyId,
          submissionId: entry.submissionId,
          instagramUrl: normalizedUrl,
          productName: entry.productName,
          thumbnailUrl: entry.thumbnailUrl,
          mediaType: entry.mediaType,
          createdAt: entry.createdAt ?? new Date().toISOString(),
        };
        const filtered = current.filter(
          (item) =>
            item.id !== nextEntry.id &&
            (!nextEntry.groupBuyId ||
              item.groupBuyId !== nextEntry.groupBuyId) &&
            (!nextEntry.submissionId ||
              item.submissionId !== nextEntry.submissionId) &&
            item.instagramUrl !== nextEntry.instagramUrl,
        );
        const next = [nextEntry, ...filtered].slice(0, MAX_WISH_ITEMS);
        void writeJSON(WISH_ITEM_KEY, next);
        return next;
      });
    },
    [],
  );

  return { wishItems, recordWishItem, refresh, ready };
}
