import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GroupBuy } from '../types';

const BOOKMARK_KEY = '@gonggu/bookmarks/v1';
const RECENT_KEY = '@gonggu/recent-views/v1';
const NOTI_KEY = '@gonggu/notifications/v1';
const MAX_RECENT = 10;

export type StoredGroupBuy = Pick<
  GroupBuy,
  'id' | 'productName' | 'brandName' | 'category' | 'startDate' | 'endDate' | 'purchaseUrl' | 'discountInfo' | 'summary' | 'confidence' | 'thumbnailUrl' | 'videoUrl' | 'mediaUrls' | 'mediaItems' | 'mediaType' | 'rawPost'
>;

export type NotificationEntry = {
  groupBuyId: string;
  productName: string | null;
  endDate: string | null;
  thumbnailUrl: string | null;
  scheduledFor: string | null;
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

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readJSON<StoredGroupBuy[]>(BOOKMARK_KEY, []).then((value) => {
      setBookmarks(value);
      setReady(true);
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((item) => item.id === id),
    [bookmarks],
  );

  const toggleBookmark = useCallback((item: GroupBuy) => {
    setBookmarks((current) => {
      const next = current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [toStored(item), ...current];
      void writeJSON(BOOKMARK_KEY, next);
      return next;
    });
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, ready };
}

export function useRecentViews() {
  const [recentViews, setRecentViews] = useState<StoredGroupBuy[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readJSON<StoredGroupBuy[]>(RECENT_KEY, []).then((value) => {
      setRecentViews(value);
      setReady(true);
    });
  }, []);

  const recordView = useCallback((item: GroupBuy) => {
    setRecentViews((current) => {
      const filtered = current.filter((entry) => entry.id !== item.id);
      const next = [toStored(item), ...filtered].slice(0, MAX_RECENT);
      void writeJSON(RECENT_KEY, next);
      return next;
    });
  }, []);

  return { recentViews, recordView, ready };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readJSON<NotificationEntry[]>(NOTI_KEY, []).then((value) => {
      setNotifications(value);
      setReady(true);
    });
  }, []);

  const isNotifying = useCallback(
    (id: string) => notifications.some((item) => item.groupBuyId === id),
    [notifications],
  );

  const toggleNotification = useCallback((item: GroupBuy) => {
    setNotifications((current) => {
      const next = current.some((entry) => entry.groupBuyId === item.id)
        ? current.filter((entry) => entry.groupBuyId !== item.id)
        : [
            {
              groupBuyId: item.id,
              productName: item.productName,
              endDate: item.endDate,
              thumbnailUrl: item.thumbnailUrl,
              scheduledFor: item.endDate,
              createdAt: new Date().toISOString(),
            },
            ...current,
          ];
      void writeJSON(NOTI_KEY, next);
      return next;
    });
  }, []);

  return { notifications, isNotifying, toggleNotification, ready };
}
