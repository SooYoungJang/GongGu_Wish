import { useCallback, useEffect, useState } from 'react';
import type { NotificationTriggerInput } from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GroupBuy } from '../types';

const BOOKMARK_KEY = '@gonggu/bookmarks/v1';
const RECENT_KEY = '@gonggu/recent-views/v1';
const NOTI_KEY = '@gonggu/notifications/v1';
const WISH_ITEM_KEY = '@gonggu/wish-items/v1';
const MAX_RECENT = 10;
const MAX_WISH_ITEMS = 50;

export type StoredGroupBuy = Pick<
  GroupBuy,
  'id' | 'productName' | 'brandName' | 'category' | 'startDate' | 'endDate' | 'purchaseUrl' | 'discountInfo' | 'summary' | 'confidence' | 'thumbnailUrl' | 'videoUrl' | 'mediaUrls' | 'mediaItems' | 'mediaType' | 'rawPost'
>;

export type NotificationEntry = {
  groupBuyId: string;
  productName: string | null;
  endDate: string | null;
  startDate: string | null;
  thumbnailUrl: string | null;
  scheduledFor: string | null;
  notificationId: string | null;
  createdAt: string;
};

export type WishItemEntry = {
  id: string;
  groupBuyId: string | null;
  submissionId: string | null;
  instagramUrl: string;
  productName: string | null;
  thumbnailUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | null;
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

const IS_EXPO_GO = Constants.appOwnership === 'expo';
type NotificationsModule = typeof import('expo-notifications');
let _notificationsModule: NotificationsModule | null = null;
async function getNotifications(): Promise<NotificationsModule | null> {
  if (IS_EXPO_GO) return null;
  if (_notificationsModule) return _notificationsModule;
  try {
    _notificationsModule = await import('expo-notifications');
    return _notificationsModule;
  } catch {
    return null;
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<StoredGroupBuy[]>(BOOKMARK_KEY, []).then((value) => {
      setBookmarks(value);
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
    const isCurrentlyBookmarked = bookmarks.some((entry) => entry.id === item.id);
    setBookmarks((current) => {
      const next = current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [toStored(item), ...current];
      void writeJSON(BOOKMARK_KEY, next);
      return next;
    });
    // Mirror to server for popularity aggregation (fire-and-forget).
    void import('../api').then(({ syncBookmark }) => syncBookmark(item.id, !isCurrentlyBookmarked));
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((current) => {
      const next = current.filter((entry) => entry.id !== id);
      void writeJSON(BOOKMARK_KEY, next);
      return next;
    });
    void import('../api').then(({ syncBookmark }) => syncBookmark(id, false));
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, refresh, ready };
}

export function useRecentViews() {
  const [recentViews, setRecentViews] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<StoredGroupBuy[]>(RECENT_KEY, []).then((value) => {
      setRecentViews(value);
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
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    readJSON<NotificationEntry[]>(NOTI_KEY, []).then((value) => {
      setNotifications(value);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isNotifying = useCallback(
    (id: string) => notifications.some((item) => item.groupBuyId === id),
    [notifications],
  );

  const toggleNotification = useCallback(async (item: GroupBuy) => {
    const existing = notifications.find((entry) => entry.groupBuyId === item.id);
    if (existing) {
      if (existing.notificationId) {
        const Notifications = await getNotifications();
        if (Notifications) {
        try {
          await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
        } catch {
          // Expo Go may not support this
        }
        }
      }
      const next = notifications.filter((entry) => entry.groupBuyId !== item.id);
      setNotifications(next);
      void writeJSON(NOTI_KEY, next);
    } else {
      let notificationId: string | null = null;
      let scheduledFor: string | null = null;
      const start = item.startDate;
      if (start) {
        const triggerDate = new Date(start);
        if (!Number.isNaN(triggerDate.getTime())) {
          const notifyAt = new Date(triggerDate.getTime() - 60 * 60 * 1000);
          if (notifyAt.getTime() > Date.now()) {
            const triggerSeconds = Math.round((notifyAt.getTime() - Date.now()) / 1000);
            if (triggerSeconds > 0) {
              const Notifications = await getNotifications();
              if (Notifications) {
              try {
                notificationId = await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '공구 시작 알림',
                    body: `${item.productName ?? '공동구매'} 공구가 곧 시작될 예정이에요!`,
                    data: { groupBuyId: item.id },
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
                      channelId: 'group-buy-start',
                    },
                    default: {
                      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                      seconds: triggerSeconds,
                      channelId: 'group-buy-start',
                    },
                  }) as NotificationTriggerInput,
                });
                scheduledFor = notifyAt.toISOString();
              } catch {
                // Expo Go does not fully support scheduled notifications
              }
              }
            }
          }
        }
      }
      const entry: NotificationEntry = {
        groupBuyId: item.id,
        productName: item.productName,
        endDate: item.endDate,
        startDate: item.startDate,
        thumbnailUrl: item.thumbnailUrl,
        scheduledFor,
        notificationId,
        createdAt: new Date().toISOString(),
      };
      const next = [entry, ...notifications];
      setNotifications(next);
      void writeJSON(NOTI_KEY, next);
    }
  }, [notifications]);

  const removeNotification = useCallback(async (groupBuyId: string) => {
    const existing = notifications.find((entry) => entry.groupBuyId === groupBuyId);
    if (existing?.notificationId) {
      const Notifications = await getNotifications();
      if (Notifications) {
        try {
          await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
        } catch {
          // ignore
        }
      }
    }
    const next = notifications.filter((entry) => entry.groupBuyId !== groupBuyId);
    setNotifications(next);
    void writeJSON(NOTI_KEY, next);
  }, [notifications]);

  return { notifications, isNotifying, toggleNotification, removeNotification, refresh, ready };
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

  const recordWishItem = useCallback((entry: Omit<WishItemEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
    setWishItems((current) => {
      const normalizedUrl = entry.instagramUrl.trim();
      const id = entry.id ?? entry.submissionId ?? entry.groupBuyId ?? normalizedUrl;
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
      const filtered = current.filter((item) =>
        item.id !== nextEntry.id &&
        (!nextEntry.groupBuyId || item.groupBuyId !== nextEntry.groupBuyId) &&
        (!nextEntry.submissionId || item.submissionId !== nextEntry.submissionId) &&
        item.instagramUrl !== nextEntry.instagramUrl,
      );
      const next = [nextEntry, ...filtered].slice(0, MAX_WISH_ITEMS);
      void writeJSON(WISH_ITEM_KEY, next);
      return next;
    });
  }, []);

  return { wishItems, recordWishItem, refresh, ready };
}
