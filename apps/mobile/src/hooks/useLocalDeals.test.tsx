import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GroupBuy } from '../types';
import { useNotifications } from './useLocalDeals';

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
  },
}));

vi.mock('expo-constants', () => ({
  default: { appOwnership: 'expo' },
}));

const GROUP_BUY: GroupBuy = {
  id: 'group-buy-1',
  productName: '테스트 공구',
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
  beforeEach(() => {
    storage.values.clear();
    storage.writeGate = null;
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
});
