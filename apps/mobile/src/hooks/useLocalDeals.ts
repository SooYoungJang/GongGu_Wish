import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGroupBuysByIds, syncNotification } from "../api";
import { useOptionalAuth } from "../context/AuthContext";
import type { GroupBuyAlertState } from "../services/notifications";
import {
  cancelScheduledNotification,
  scheduleGroupBuyStart,
} from "../services/notifications";
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
  if (entry.notificationId || entry.scheduledFor) {
    return {
      status: "enabled",
      notificationId: entry.notificationId,
      scheduledFor: entry.scheduledFor,
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
  groupBuyId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${namespace}:${groupBuyId}`;
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

async function enableNotification(
  namespace: string,
  storageKey: string,
  current: NotificationEntry[],
  item: GroupBuy,
): Promise<GroupBuyAlertState> {
  const pendingEntry: NotificationEntry = {
    groupBuyId: item.id,
    ...toNotificationDealFields(item),
    scheduledFor: null,
    notificationId: null,
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

  const result = await scheduleGroupBuyStart(
    item.id,
    item.productName,
    item.startDate,
  );
  const alertState = alertStateFromScheduleResult(result);
  const completedEntry: NotificationEntry = {
    ...pendingEntry,
    scheduledFor:
      alertState.status === "enabled" ? alertState.scheduledFor : null,
    notificationId:
      alertState.status === "enabled" ? alertState.notificationId : null,
    alertState,
  };
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

  if (existing.notificationId) {
    const result = await cancelScheduledNotification(existing.notificationId);
    if (result.status === "failed") {
      const failedState: GroupBuyAlertState = {
        status: "failed",
        action: "disable",
        reason: "cancel-failed",
        retryable: true,
      };
      await persistNotifications(namespace, storageKey, [
        { ...pendingEntry, alertState: failedState },
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
    storedNotifications
      .map((entry) => entry.notificationId)
      .filter((notificationId): notificationId is string =>
        Boolean(notificationId),
      )
      .map((notificationId) => cancelScheduledNotification(notificationId)),
  );

  const notificationKeys = [storageKey, notificationOutboxKey(namespace)];
  if (namespace === GUEST_NAMESPACE) notificationKeys.push(NOTI_KEY);

  await Promise.all(
    [BOOKMARK_KEY, RECENT_KEY, ...notificationKeys, WISH_ITEM_KEY].map(
      async (key) => {
        try {
          await AsyncStorage.removeItem(key);
        } catch {
          // Local storage cleanup is best-effort after the server deletion.
        }
      },
    ),
  );
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
  const [recentViews, setRecentViews] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<StoredGroupBuy[]>(RECENT_KEY, []).then(async (value) => {
      const hydrated = await hydrateStoredDeals(RECENT_KEY, value);
      setRecentViews(hydrated);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordView = useCallback((item: GroupBuy) => {
    setRecentViews((current) => {
      const filtered = current.filter((entry) => entry.id !== item.id);
      const next = [toStored(item), ...filtered].slice(0, MAX_RECENT);
      void writeJSON(RECENT_KEY, next);
      return next;
    });
  }, []);

  return { recentViews, recordView, refresh, ready };
}

export function useNotifications() {
  const auth = useOptionalAuth();
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
          : enableNotification(namespace, storageKey, current, item);
      }),
    [namespace, storageKey],
  );

  const retryNotification = useCallback(
    (item: GroupBuy) =>
      enqueueNotificationOperation(namespace, item.id, async () => {
        const current = getNotificationSnapshot(namespace);
        return enableNotification(namespace, storageKey, current, item);
      }),
    [namespace, storageKey],
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

  return {
    notifications,
    isNotifying,
    getNotificationState,
    toggleNotification,
    retryNotification,
    removeNotification,
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
