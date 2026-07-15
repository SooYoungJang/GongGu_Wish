import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GroupBuy } from '../types';
import { clearLocalUserData, useBookmarks, useNotifications, useRecentViews } from './useLocalDeals';

const apiMocks = vi.hoisted(() => ({
  fetchGroupBuysByIds: vi.fn().mockResolvedValue([]),
  syncBookmark: vi.fn().mockResolvedValue(undefined),
  syncNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../api', () => apiMocks);

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writeGate: null as Promise<void> | null,
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      if (storage.writeGate) await storage.writeGate;
      storage.values.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.values.delete(key);
    }),
  },
}));

vi.mock('expo-constants', () => ({
  default: { appOwnership: 'expo' },
}));

const GROUP_BUY: GroupBuy = {
  id: 'group-buy-1',
  productName: '테스트 공구',
  priceKrw: 200000,
  brandName: null,
  category: 'living',
  startDate: null,
  endDate: null,
  purchaseUrl: null,
  discountInfo: null,
  summary: null,
  confidence: 1,
  thumbnailUrl: null,
  videoUrl: null,
  mediaUrls: [],
  mediaType: null,
  rawPost: {
    postUrl: '',
    influencer: { instagramUsername: 'seller' },
  },
};

describe('useNotifications', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    storage.values.clear();
    storage.writeGate = null;
    apiMocks.fetchGroupBuysByIds.mockReset().mockResolvedValue([]);
    apiMocks.syncBookmark.mockReset().mockResolvedValue(undefined);
    apiMocks.syncNotification.mockReset().mockResolvedValue(undefined);
  });

  it('동시에 마운트된 다른 화면에도 알림 변경을 즉시 반영한다', async () => {
    const ranking = renderHook(() => useNotifications());
    const reels = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(ranking.result.current.ready).toBe(true);
      expect(reels.result.current.ready).toBe(true);
    });

    await act(async () => {
      await ranking.result.current.toggleNotification(GROUP_BUY);
    });

    expect(ranking.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
    expect(reels.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
  });

  it('활동 카드에 홈 카드와 같은 가격 데이터를 보존한다', async () => {
    const bookmarks = renderHook(() => useBookmarks());
    const recentViews = renderHook(() => useRecentViews());
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(bookmarks.result.current.ready).toBe(true);
      expect(recentViews.result.current.ready).toBe(true);
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      bookmarks.result.current.toggleBookmark(GROUP_BUY);
      recentViews.result.current.recordView(GROUP_BUY);
      await notifications.result.current.toggleNotification(GROUP_BUY);
    });

    await waitFor(() => {
      expect(JSON.parse(storage.values.get('@gonggu/bookmarks/v1') ?? '[]')[0].priceKrw).toBe(200000);
      expect(JSON.parse(storage.values.get('@gonggu/recent-views/v1') ?? '[]')[0].priceKrw).toBe(200000);
      expect(JSON.parse(storage.values.get('@gonggu/notifications/v1') ?? '[]')[0].priceKrw).toBe(200000);
    });
  });

  it('기존 활동 데이터도 최신 가격과 할인정보로 보강한다', async () => {
    const legacyStoredDeal = { ...GROUP_BUY, priceKrw: undefined, discountInfo: undefined };
    const legacyNotification = {
      groupBuyId: GROUP_BUY.id,
      productName: GROUP_BUY.productName,
      endDate: GROUP_BUY.endDate,
      startDate: GROUP_BUY.startDate,
      thumbnailUrl: GROUP_BUY.thumbnailUrl,
      scheduledFor: null,
      notificationId: null,
      createdAt: '2026-07-15T00:00:00.000Z',
    };
    const enrichedDeal = {
      ...GROUP_BUY,
      brandName: '테스트 브랜드',
      discountInfo: '20% 할인',
      thumbnailUrl: 'https://example.com/deal.png',
    };

    storage.values.set('@gonggu/bookmarks/v1', JSON.stringify([legacyStoredDeal]));
    storage.values.set('@gonggu/recent-views/v1', JSON.stringify([legacyStoredDeal]));
    storage.values.set('@gonggu/notifications/v1', JSON.stringify([legacyNotification]));
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([enrichedDeal]);

    const bookmarks = renderHook(() => useBookmarks());
    const recentViews = renderHook(() => useRecentViews());
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(bookmarks.result.current.ready).toBe(true);
      expect(recentViews.result.current.ready).toBe(true);
      expect(notifications.result.current.ready).toBe(true);
    });

    expect(bookmarks.result.current.bookmarks[0]).toMatchObject({ priceKrw: 200000, discountInfo: '20% 할인' });
    expect(recentViews.result.current.recentViews[0]).toMatchObject({ priceKrw: 200000, discountInfo: '20% 할인' });
    expect(notifications.result.current.notifications[0]).toMatchObject({
      priceKrw: 200000,
      brandName: '테스트 브랜드',
      discountInfo: '20% 할인',
    });
    expect(apiMocks.fetchGroupBuysByIds).toHaveBeenCalled();
  });

  it('나중에 마운트된 화면도 첫 렌더부터 마지막 알림 상태를 사용한다', async () => {
    const ranking = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(ranking.result.current.ready).toBe(true);
    });
    await act(async () => {
      await ranking.result.current.toggleNotification(GROUP_BUY);
    });

    const reels = renderHook(() => useNotifications());

    expect(reels.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
  });

  it('저장 중 새로 마운트된 화면에도 완료된 알림 상태를 전파한다', async () => {
    let releaseWrite!: () => void;
    storage.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const ranking = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(ranking.result.current.ready).toBe(true);
    });

    let togglePromise!: Promise<void>;
    act(() => {
      togglePromise = ranking.result.current.toggleNotification(GROUP_BUY);
    });

    const reels = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(reels.result.current.ready).toBe(true);
    });

    await act(async () => {
      releaseWrite();
      await togglePromise;
    });

    expect(reels.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
  });

  it('회원탈퇴 후 로컬 활동 데이터를 비운다', async () => {
    storage.values.set('@gonggu/bookmarks/v1', JSON.stringify([GROUP_BUY]));
    storage.values.set('@gonggu/recent-views/v1', JSON.stringify([GROUP_BUY]));
    storage.values.set('@gonggu/notifications/v1', JSON.stringify([{ notificationId: null }]));
    storage.values.set('@gonggu/wish-items/v1', JSON.stringify([{ id: 'wish-1' }]));

    await clearLocalUserData();

    expect(storage.values.has('@gonggu/bookmarks/v1')).toBe(false);
    expect(storage.values.has('@gonggu/recent-views/v1')).toBe(false);
    expect(storage.values.has('@gonggu/notifications/v1')).toBe(false);
    expect(storage.values.has('@gonggu/wish-items/v1')).toBe(false);
  });
});
