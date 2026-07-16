import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import {
  clearLocalUserData,
  useBookmarks,
  useNotifications,
  useRecentViews,
} from "./useLocalDeals";

const apiMocks = vi.hoisted(() => ({
  fetchGroupBuysByIds: vi.fn().mockResolvedValue([]),
  syncBookmark: vi.fn().mockResolvedValue(undefined),
  syncNotification: vi.fn().mockResolvedValue(undefined),
}));

const notificationServiceMocks = vi.hoisted(() => ({
  scheduleGroupBuyStart: vi.fn().mockResolvedValue({
    status: "unavailable",
    reason: "missing-start-date",
  }),
  cancelScheduledNotification: vi
    .fn()
    .mockResolvedValue({ status: "cancelled" }),
}));
const authMocks = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("../api", () => apiMocks);
vi.mock("../context/AuthContext", () => ({
  useOptionalAuth: () => (authMocks.user ? { user: authMocks.user } : null),
}));
vi.mock("../services/notifications", () => notificationServiceMocks);

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writeGate: null as Promise<void> | null,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
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

vi.mock("expo-constants", () => ({
  default: { appOwnership: "expo" },
}));

const GROUP_BUY: GroupBuy = {
  id: "group-buy-1",
  productName: "테스트 공구",
  priceKrw: 200000,
  brandName: null,
  category: "living",
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
    postUrl: "",
    influencer: { instagramUsername: "seller" },
  },
};

describe("useNotifications", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    storage.values.clear();
    storage.writeGate = null;
    apiMocks.fetchGroupBuysByIds.mockReset().mockResolvedValue([]);
    apiMocks.syncBookmark.mockReset().mockResolvedValue(undefined);
    apiMocks.syncNotification.mockReset().mockResolvedValue(undefined);
    notificationServiceMocks.scheduleGroupBuyStart
      .mockReset()
      .mockResolvedValue({
        status: "unavailable",
        reason: "missing-start-date",
      });
    notificationServiceMocks.cancelScheduledNotification
      .mockReset()
      .mockResolvedValue({ status: "cancelled" });
    authMocks.user = null;
  });

  it("동시에 마운트된 다른 화면에도 알림 변경을 즉시 반영한다", async () => {
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

  it("활동 카드에 홈 카드와 같은 가격 데이터를 보존한다", async () => {
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
      expect(
        JSON.parse(storage.values.get("@gonggu/bookmarks/v1") ?? "[]")[0]
          .priceKrw,
      ).toBe(200000);
      expect(
        JSON.parse(storage.values.get("@gonggu/recent-views/v1") ?? "[]")[0]
          .priceKrw,
      ).toBe(200000);
      expect(
        JSON.parse(
          storage.values.get("@gonggu/notifications/v2/guest") ?? "[]",
        )[0].priceKrw,
      ).toBe(200000);
    });
  });

  it("기존 활동 데이터도 최신 가격과 할인정보로 보강한다", async () => {
    const legacyStoredDeal = {
      ...GROUP_BUY,
      priceKrw: undefined,
      discountInfo: undefined,
    };
    const legacyNotification = {
      groupBuyId: GROUP_BUY.id,
      productName: GROUP_BUY.productName,
      endDate: GROUP_BUY.endDate,
      startDate: GROUP_BUY.startDate,
      thumbnailUrl: GROUP_BUY.thumbnailUrl,
      scheduledFor: null,
      notificationId: null,
      createdAt: "2026-07-15T00:00:00.000Z",
    };
    const enrichedDeal = {
      ...GROUP_BUY,
      brandName: "테스트 브랜드",
      discountInfo: "20% 할인",
      thumbnailUrl: "https://example.com/deal.png",
    };

    storage.values.set(
      "@gonggu/bookmarks/v1",
      JSON.stringify([legacyStoredDeal]),
    );
    storage.values.set(
      "@gonggu/recent-views/v1",
      JSON.stringify([legacyStoredDeal]),
    );
    storage.values.set(
      "@gonggu/notifications/v1",
      JSON.stringify([legacyNotification]),
    );
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([enrichedDeal]);

    const bookmarks = renderHook(() => useBookmarks());
    const recentViews = renderHook(() => useRecentViews());
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(bookmarks.result.current.ready).toBe(true);
      expect(recentViews.result.current.ready).toBe(true);
      expect(notifications.result.current.ready).toBe(true);
    });

    expect(bookmarks.result.current.bookmarks[0]).toMatchObject({
      priceKrw: 200000,
      discountInfo: "20% 할인",
    });
    expect(recentViews.result.current.recentViews[0]).toMatchObject({
      priceKrw: 200000,
      discountInfo: "20% 할인",
    });
    expect(notifications.result.current.notifications[0]).toMatchObject({
      priceKrw: 200000,
      brandName: "테스트 브랜드",
      discountInfo: "20% 할인",
    });
    expect(apiMocks.fetchGroupBuysByIds).toHaveBeenCalled();
  });

  it("나중에 마운트된 화면도 첫 렌더부터 마지막 알림 상태를 사용한다", async () => {
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

  it("저장 중 새로 마운트된 화면에도 완료된 알림 상태를 전파한다", async () => {
    let releaseWrite!: () => void;
    storage.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const ranking = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(ranking.result.current.ready).toBe(true);
    });

    let togglePromise!: Promise<unknown>;
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

  it("회원탈퇴 후 로컬 활동 데이터를 비운다", async () => {
    storage.values.set("@gonggu/bookmarks/v1", JSON.stringify([GROUP_BUY]));
    storage.values.set("@gonggu/recent-views/v1", JSON.stringify([GROUP_BUY]));
    storage.values.set(
      "@gonggu/notifications/v1",
      JSON.stringify([{ notificationId: null }]),
    );
    storage.values.set(
      "@gonggu/wish-items/v1",
      JSON.stringify([{ id: "wish-1" }]),
    );

    await clearLocalUserData();

    expect(storage.values.has("@gonggu/bookmarks/v1")).toBe(false);
    expect(storage.values.has("@gonggu/recent-views/v1")).toBe(false);
    expect(storage.values.has("@gonggu/notifications/v1")).toBe(false);
    expect(storage.values.has("@gonggu/wish-items/v1")).toBe(false);
  });

  it("예약 결과를 관심 저장 상태와 분리해 노출한다", async () => {
    const scheduledFor = "2026-07-16T17:00:00.000Z";
    notificationServiceMocks.scheduleGroupBuyStart.mockResolvedValueOnce({
      status: "scheduled",
      notification: {
        id: "native-notification-1",
        groupBuyId: GROUP_BUY.id,
        productName: GROUP_BUY.productName,
        triggerDate: new Date(scheduledFor),
      },
    });
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      await notifications.result.current.toggleNotification({
        ...GROUP_BUY,
        startDate: "2026-07-16T18:00:00.000Z",
      });
    });

    expect(notifications.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
    expect(
      notifications.result.current.getNotificationState(GROUP_BUY.id),
    ).toEqual({
      status: "enabled",
      notificationId: "native-notification-1",
      scheduledFor,
    });
  });

  it("keeps an unavailable reservation distinguishable from an enabled alert", async () => {
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      await notifications.result.current.toggleNotification(GROUP_BUY);
    });

    expect(notifications.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
    expect(
      notifications.result.current.getNotificationState(GROUP_BUY.id),
    ).toEqual({
      status: "unavailable",
      reason: "missing-start-date",
    });
  });

  it("serializes rapid double taps into one schedule and one cancellation", async () => {
    let releaseSchedule!: (result: unknown) => void;
    notificationServiceMocks.scheduleGroupBuyStart.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSchedule = resolve;
      }),
    );
    const notifications = renderHook(() => useNotifications());
    const item = {
      ...GROUP_BUY,
      startDate: "2026-07-16T18:00:00.000Z",
    };

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    let firstToggle!: Promise<unknown>;
    let secondToggle!: Promise<unknown>;
    act(() => {
      firstToggle = notifications.result.current.toggleNotification(item);
      secondToggle = notifications.result.current.toggleNotification(item);
    });

    await waitFor(() => {
      expect(
        notificationServiceMocks.scheduleGroupBuyStart,
      ).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      releaseSchedule({
        status: "scheduled",
        notification: {
          id: "native-notification-rapid",
          groupBuyId: item.id,
          productName: item.productName,
          triggerDate: new Date("2026-07-16T17:00:00.000Z"),
        },
      });
      await Promise.all([firstToggle, secondToggle]);
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyStart,
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationServiceMocks.cancelScheduledNotification,
    ).toHaveBeenCalledWith("native-notification-rapid");
    expect(notifications.result.current.isNotifying(item.id)).toBe(false);
  });

  it("keeps failed server mirrors in a retryable outbox", async () => {
    apiMocks.syncNotification.mockReset().mockResolvedValue(false);
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      await notifications.result.current.toggleNotification(GROUP_BUY);
    });
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        GROUP_BUY.id,
        true,
      );
    });
    expect(
      JSON.parse(
        storage.values.get("@gonggu/notifications/outbox/v1/guest") ?? "[]",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupBuyId: GROUP_BUY.id, enabled: true }),
      ]),
    );

    apiMocks.syncNotification.mockResolvedValue(true);
    await act(async () => {
      notifications.result.current.refresh();
      await waitFor(() => {
        expect(
          JSON.parse(
            storage.values.get("@gonggu/notifications/outbox/v1/guest") ?? "[]",
          ),
        ).toEqual([]);
      });
    });
  });

  it("isolates authenticated notification data from the guest namespace", async () => {
    authMocks.user = { id: "user-1" };
    storage.values.set(
      "@gonggu/notifications/v2/guest",
      JSON.stringify([
        { ...GROUP_BUY, scheduledFor: null, notificationId: null },
      ]),
    );
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    expect(notifications.result.current.notifications).toHaveLength(0);
    expect(storage.values.has("@gonggu/notifications/v2/user%3Auser-1")).toBe(
      false,
    );
  });
});
