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

const notificationServiceMocks = vi.hoisted(() => {
  const cancelScheduledNotification = vi
    .fn()
    .mockResolvedValue({ status: "cancelled" });
  return {
    scheduleGroupBuyStart: vi.fn().mockResolvedValue({
      status: "unavailable",
      reason: "missing-start-date",
    }),
    scheduleGroupBuyReminders: vi.fn().mockResolvedValue({
      status: "unavailable",
      reason: "missing-end-date",
    }),
    cancelScheduledNotification,
    cancelScheduledNotifications: vi.fn(async (ids: string[]) => {
      for (const id of [...new Set(ids)]) {
        await cancelScheduledNotification(id);
      }
      return { cancelledIds: [...new Set(ids)], failedIds: [] as string[] };
    }),
  };
});
const authMocks = vi.hoisted(() => ({ user: null as { id: string } | null }));
const notificationPreferenceMocks = vi.hoisted(() => ({
  preferences: {
    pushEnabled: true,
    deadlineRemindersEnabled: true,
    newSubmissionsEnabled: true,
    reminderDays: [1, 3, 7] as Array<1 | 3 | 7>,
    followedInfluencers: [] as string[],
    followedBrands: [] as string[],
  },
}));

vi.mock("../api", () => apiMocks);
vi.mock("../context/AuthContext", () => ({
  useOptionalAuth: () => (authMocks.user ? { user: authMocks.user } : null),
}));
vi.mock("../context/NotificationPreferencesContext", () => ({
  useNotificationPreferences: () => notificationPreferenceMocks,
}));
vi.mock("../services/notifications", () => notificationServiceMocks);

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  readPlans: [] as Array<{
    snapshot: string | null;
    gate: Promise<void>;
  }>,
  writeGate: null as Promise<void> | null,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      const plannedRead = storage.readPlans.shift();
      const value = plannedRead
        ? plannedRead.snapshot
        : (storage.values.get(key) ?? null);
      if (plannedRead) await plannedRead.gate;
      return value;
    }),
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
    storage.readPlans.length = 0;
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
    notificationServiceMocks.scheduleGroupBuyReminders
      .mockReset()
      .mockResolvedValue({
        status: "unavailable",
        reason: "missing-end-date",
      });
    notificationServiceMocks.cancelScheduledNotification
      .mockReset()
      .mockResolvedValue({ status: "cancelled" });
    notificationServiceMocks.cancelScheduledNotifications
      .mockReset()
      .mockImplementation(async (ids: string[]) => {
        for (const id of [...new Set(ids)]) {
          await notificationServiceMocks.cancelScheduledNotification(id);
        }
        return { cancelledIds: [...new Set(ids)], failedIds: [] as string[] };
      });
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

  it("마운트 직후 기록해도 저장된 최근 본 공구를 유실하지 않는다", async () => {
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const storedDeal = {
      ...GROUP_BUY,
      id: "group-buy-existing",
      productName: "기존 공구",
    };
    const newlyViewedDeal = {
      ...GROUP_BUY,
      id: "group-buy-new",
      productName: "새 공구",
    };
    storage.values.set("@gonggu/recent-views/v1", JSON.stringify([storedDeal]));
    storage.readPlans.push({
      snapshot: JSON.stringify([storedDeal]),
      gate: readGate,
    });

    const recentViews = renderHook(() => useRecentViews());

    act(() => {
      recentViews.result.current.recordView(newlyViewedDeal);
    });
    await act(async () => {
      releaseRead();
    });
    await waitFor(() => {
      expect(recentViews.result.current.ready).toBe(true);
    });

    expect(
      recentViews.result.current.recentViews.map((deal) => deal.id),
    ).toEqual(["group-buy-new", "group-buy-existing"]);
    await waitFor(() => {
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
      ).toEqual(["group-buy-new", "group-buy-existing"]);
    });
  });

  it("최근 본 공구를 중복 없이 최신순 10개까지만 저장한다", async () => {
    const storedDeals = Array.from({ length: 10 }, (_, index) => ({
      ...GROUP_BUY,
      id: `group-buy-${index}`,
      productName: `공구 ${index}`,
    }));
    storage.values.set("@gonggu/recent-views/v1", JSON.stringify(storedDeals));
    const recentViews = renderHook(() => useRecentViews());

    await waitFor(() => {
      expect(recentViews.result.current.ready).toBe(true);
    });
    act(() => {
      recentViews.result.current.recordView(storedDeals[5]);
    });
    act(() => {
      recentViews.result.current.recordView({
        ...GROUP_BUY,
        id: "group-buy-new",
        productName: "새 공구",
      });
    });

    const expectedIds = [
      "group-buy-new",
      "group-buy-5",
      "group-buy-0",
      "group-buy-1",
      "group-buy-2",
      "group-buy-3",
      "group-buy-4",
      "group-buy-6",
      "group-buy-7",
      "group-buy-8",
    ];
    expect(
      recentViews.result.current.recentViews.map((deal) => deal.id),
    ).toEqual(expectedIds);
    await waitFor(() => {
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
      ).toEqual(expectedIds);
    });
  });

  it("동시에 마운트된 화면들의 최근 본 공구를 저장소에 모두 누적한다", async () => {
    const storedDealA = {
      ...GROUP_BUY,
      id: "group-buy-a",
      productName: "공구 A",
    };
    const viewedDealB = {
      ...GROUP_BUY,
      id: "group-buy-b",
      productName: "공구 B",
    };
    const viewedDealC = {
      ...GROUP_BUY,
      id: "group-buy-c",
      productName: "공구 C",
    };
    storage.values.set(
      "@gonggu/recent-views/v1",
      JSON.stringify([storedDealA]),
    );
    const firstScreen = renderHook(() => useRecentViews());
    const secondScreen = renderHook(() => useRecentViews());

    await waitFor(() => {
      expect(firstScreen.result.current.ready).toBe(true);
      expect(secondScreen.result.current.ready).toBe(true);
    });
    act(() => {
      firstScreen.result.current.recordView(viewedDealB);
    });
    act(() => {
      secondScreen.result.current.recordView(viewedDealC);
    });

    await waitFor(() => {
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
      ).toEqual(["group-buy-c", "group-buy-b", "group-buy-a"]);
    });
  });

  it("늦게 끝난 이전 refresh 응답이 최신 최근 본 공구를 덮지 않는다", async () => {
    const storedDealA = {
      ...GROUP_BUY,
      id: "group-buy-a",
      productName: "공구 A",
    };
    const latestDealB = {
      ...GROUP_BUY,
      id: "group-buy-b",
      productName: "공구 B",
    };
    storage.values.set(
      "@gonggu/recent-views/v1",
      JSON.stringify([storedDealA]),
    );
    const recentViews = renderHook(() => useRecentViews());
    await waitFor(() => {
      expect(recentViews.result.current.ready).toBe(true);
    });

    let releaseStaleRead!: () => void;
    let releaseLatestRead!: () => void;
    const staleReadGate = new Promise<void>((resolve) => {
      releaseStaleRead = resolve;
    });
    const latestReadGate = new Promise<void>((resolve) => {
      releaseLatestRead = resolve;
    });
    storage.readPlans.push(
      {
        snapshot: JSON.stringify([storedDealA]),
        gate: staleReadGate,
      },
      {
        snapshot: JSON.stringify([latestDealB, storedDealA]),
        gate: latestReadGate,
      },
    );

    act(() => {
      recentViews.result.current.refresh();
      recentViews.result.current.refresh();
    });
    await waitFor(() => {
      expect(storage.readPlans).toHaveLength(1);
    });

    await act(async () => {
      releaseStaleRead();
    });
    await waitFor(() => {
      expect(storage.readPlans).toHaveLength(0);
    });

    await act(async () => {
      releaseLatestRead();
    });
    await waitFor(() => {
      expect(
        recentViews.result.current.recentViews.map((deal) => deal.id),
      ).toEqual(["group-buy-b", "group-buy-a"]);
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
    storage.values.set(
      "@gonggu/notification-preferences/v1/guest",
      JSON.stringify({ followedBrands: ["Brand A"] }),
    );
    storage.values.set(
      "@gonggu/notification-preferences/v1/guest/pending",
      JSON.stringify({ pushEnabled: false }),
    );

    await clearLocalUserData();

    expect(storage.values.has("@gonggu/bookmarks/v1")).toBe(false);
    expect(storage.values.has("@gonggu/recent-views/v1")).toBe(false);
    expect(storage.values.has("@gonggu/notifications/v1")).toBe(false);
    expect(storage.values.has("@gonggu/wish-items/v1")).toBe(false);
    expect(
      storage.values.has("@gonggu/notification-preferences/v1/guest"),
    ).toBe(false);
    expect(
      storage.values.has("@gonggu/notification-preferences/v1/guest/pending"),
    ).toBe(false);
  });

  it("serializes different group-buy writes without dropping either entry", async () => {
    notificationServiceMocks.scheduleGroupBuyStart
      .mockResolvedValueOnce({
        status: "scheduled",
        notification: {
          id: "native-a",
          groupBuyId: "group-buy-a",
          productName: "공구 A",
          triggerDate: new Date("2026-07-20T12:00:00.000Z"),
        },
      })
      .mockResolvedValueOnce({
        status: "scheduled",
        notification: {
          id: "native-b",
          groupBuyId: "group-buy-b",
          productName: "공구 B",
          triggerDate: new Date("2026-07-20T13:00:00.000Z"),
        },
      });
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await Promise.all([
        notifications.result.current.toggleNotification({
          ...GROUP_BUY,
          id: "group-buy-a",
          productName: "공구 A",
          startDate: "2026-07-20T13:00:00.000Z",
        }),
        notifications.result.current.toggleNotification({
          ...GROUP_BUY,
          id: "group-buy-b",
          productName: "공구 B",
          startDate: "2026-07-20T14:00:00.000Z",
        }),
      ]);
    });

    expect(
      notifications.result.current.notifications.map(
        (entry) => entry.groupBuyId,
      ),
    ).toEqual(expect.arrayContaining(["group-buy-a", "group-buy-b"]));
    expect(notifications.result.current.notifications).toHaveLength(2);
  });

  it("retries a failed disable by cancelling instead of scheduling again", async () => {
    storage.values.set(
      "@gonggu/notifications/v2/guest",
      JSON.stringify([
        {
          ...GROUP_BUY,
          groupBuyId: GROUP_BUY.id,
          notificationId: "native-disable",
          notificationIds: ["native-disable"],
          scheduledFor: "2026-07-20T12:00:00.000Z",
          scheduledForDates: ["2026-07-20T12:00:00.000Z"],
          alertState: {
            status: "failed",
            action: "disable",
            reason: "cancel-failed",
            retryable: true,
          },
          createdAt: "2026-07-17T00:00:00.000Z",
        },
      ]),
    );
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await notifications.result.current.retryNotification(GROUP_BUY);
    });

    expect(
      notificationServiceMocks.cancelScheduledNotifications,
    ).toHaveBeenCalledWith(["native-disable"]);
    expect(
      notificationServiceMocks.scheduleGroupBuyStart,
    ).not.toHaveBeenCalled();
    expect(notifications.result.current.isNotifying(GROUP_BUY.id)).toBe(false);
  });

  it("retains failed cancellation IDs for a later reschedule retry", async () => {
    storage.values.set(
      "@gonggu/notifications/v2/guest",
      JSON.stringify([
        {
          ...GROUP_BUY,
          groupBuyId: GROUP_BUY.id,
          notificationId: "deadline-1",
          notificationIds: ["deadline-1", "deadline-3"],
          scheduledFor: "2026-07-19T12:00:00.000Z",
          scheduledForDates: [
            "2026-07-19T12:00:00.000Z",
            "2026-07-17T12:00:00.000Z",
          ],
          alertState: {
            status: "enabled",
            notificationId: "deadline-1",
            notificationIds: ["deadline-1", "deadline-3"],
            scheduledFor: "2026-07-19T12:00:00.000Z",
            scheduledForDates: [
              "2026-07-19T12:00:00.000Z",
              "2026-07-17T12:00:00.000Z",
            ],
          },
          createdAt: "2026-07-17T00:00:00.000Z",
        },
      ]),
    );
    notificationServiceMocks.cancelScheduledNotifications.mockResolvedValueOnce(
      {
        cancelledIds: ["deadline-1"],
        failedIds: ["deadline-3"],
      },
    );
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await notifications.result.current.rescheduleNotifications({
        pushEnabled: true,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: true,
        reminderDays: [3],
        followedInfluencers: [],
        followedBrands: [],
      });
    });

    expect(notifications.result.current.notifications[0]).toEqual(
      expect.objectContaining({
        notificationId: "deadline-3",
        notificationIds: ["deadline-3"],
        scheduledFor: "2026-07-17T12:00:00.000Z",
        scheduledForDates: ["2026-07-17T12:00:00.000Z"],
      }),
    );
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

  it("stores and cancels every D-day native reminder for a deadline", async () => {
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "scheduled",
      notifications: [
        {
          id: "deadline-7",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          reminderDay: 7,
          triggerDate: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          id: "deadline-1",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          reminderDay: 1,
          triggerDate: new Date("2026-07-26T00:00:00.000Z"),
        },
      ],
    });
    const notifications = renderHook(() => useNotifications());
    const item = {
      ...GROUP_BUY,
      endDate: "2026-07-27T00:00:00.000Z",
    };

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await notifications.result.current.toggleNotification(item);
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledWith(item.id, item.productName, item.endDate, [1, 3, 7]);
    expect(notifications.result.current.getNotificationState(item.id)).toEqual({
      status: "enabled",
      notificationId: "deadline-7",
      scheduledFor: "2026-07-20T00:00:00.000Z",
      notificationIds: ["deadline-7", "deadline-1"],
      scheduledForDates: [
        "2026-07-20T00:00:00.000Z",
        "2026-07-26T00:00:00.000Z",
      ],
    });

    await act(async () => {
      await notifications.result.current.toggleNotification(item);
    });
    expect(
      notificationServiceMocks.cancelScheduledNotifications,
    ).toHaveBeenCalledWith(["deadline-7", "deadline-1"]);
    expect(notifications.result.current.isNotifying(item.id)).toBe(false);
  });

  it("reconciles existing native IDs when reminder preferences change", async () => {
    notificationServiceMocks.scheduleGroupBuyReminders
      .mockResolvedValueOnce({
        status: "scheduled",
        notifications: [
          {
            id: "deadline-old-7",
            groupBuyId: GROUP_BUY.id,
            productName: GROUP_BUY.productName,
            triggerDate: new Date("2026-07-20T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        status: "scheduled",
        notifications: [
          {
            id: "deadline-new-3",
            groupBuyId: GROUP_BUY.id,
            productName: GROUP_BUY.productName,
            triggerDate: new Date("2026-07-24T00:00:00.000Z"),
          },
        ],
      });
    const notifications = renderHook(() => useNotifications());
    const item = {
      ...GROUP_BUY,
      endDate: "2026-07-27T00:00:00.000Z",
    };
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await notifications.result.current.toggleNotification(item);
      await notifications.result.current.rescheduleNotifications({
        pushEnabled: true,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: true,
        reminderDays: [3],
        followedInfluencers: [],
        followedBrands: [],
      });
    });

    expect(
      notificationServiceMocks.cancelScheduledNotifications,
    ).toHaveBeenCalledWith(["deadline-old-7"]);
    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenLastCalledWith(item.id, item.productName, item.endDate, [3]);
    expect(notifications.result.current.getNotificationState(item.id)).toEqual(
      expect.objectContaining({
        status: "enabled",
        notificationIds: ["deadline-new-3"],
      }),
    );
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
