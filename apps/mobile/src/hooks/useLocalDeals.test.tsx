import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import { resolveAudiencePolicy } from "../audience/audiencePolicy";
import { setAudiencePolicySnapshot } from "../audience/behaviorSignalsPolicy";
import {
  clearLocalUserData,
  useBookmarks,
  useNotifications,
  useRecentViews,
  useWishItems,
} from "./useLocalDeals";
import { signOutLocalNotifications } from "../services/localNotificationSession";

const apiMocks = vi.hoisted(() => ({
  fetchGroupBuysByIds: vi.fn().mockResolvedValue([]),
  fetchNotificationReminders: vi.fn().mockResolvedValue([]),
  syncBookmark: vi.fn().mockResolvedValue(undefined),
  syncNotification: vi.fn().mockResolvedValue({
    status: "synced",
    preference: null,
  }),
}));

const notificationServiceMocks = vi.hoisted(() => {
  const cancelScheduledNotification = vi
    .fn()
    .mockResolvedValue({ status: "cancelled" });
  return {
    ensureNotificationPermission: vi.fn().mockResolvedValue(true),
    requestNotificationPermissions: vi.fn().mockResolvedValue(true),
    scheduleGroupBuyOpeningReminders: vi.fn().mockResolvedValue({
      status: "unavailable",
      reason: "missing-start-date",
    }),
    scheduleGroupBuyReminders: vi.fn().mockResolvedValue({
      status: "unavailable",
      reason: "missing-end-date",
    }),
    cancelScheduledNotification,
    cancelAllScheduledNotifications: vi.fn().mockResolvedValue(undefined),
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
    submissionApprovalEnabled: true,
    marketingPushEnabled: false,
    reminderDays: [1, 3, 7] as Array<1 | 3 | 7>,
    followedInfluencers: [] as string[],
    followedBrands: [] as string[],
  },
  updatePreferences: vi.fn(async (patch: { pushEnabled?: boolean }) => {
    if (patch.pushEnabled !== undefined) {
      notificationPreferenceMocks.preferences.pushEnabled = patch.pushEnabled;
    }
    return notificationPreferenceMocks.preferences;
  }),
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
  nextGetItemError: null as Error | null,
  writeGate: null as Promise<void> | null,
  writeAttempts: 0,
  attemptedWrites: [] as Array<{ key: string; value: string }>,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: vi.fn(async () => [...storage.values.keys()]),
    getItem: vi.fn(async (key: string) => {
      if (storage.nextGetItemError) {
        const error = storage.nextGetItemError;
        storage.nextGetItemError = null;
        throw error;
      }
      const plannedRead = storage.readPlans.shift();
      const value = plannedRead
        ? plannedRead.snapshot
        : (storage.values.get(key) ?? null);
      if (plannedRead) await plannedRead.gate;
      return value;
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.writeAttempts += 1;
      storage.attemptedWrites.push({ key, value });
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
  afterEach(async () => {
    cleanup();
    await clearLocalUserData();
  });

  beforeEach(() => {
    storage.values.clear();
    storage.readPlans.length = 0;
    storage.nextGetItemError = null;
    storage.writeGate = null;
    storage.writeAttempts = 0;
    storage.attemptedWrites.length = 0;
    apiMocks.fetchGroupBuysByIds.mockReset().mockResolvedValue([]);
    apiMocks.fetchNotificationReminders.mockReset().mockResolvedValue([]);
    apiMocks.syncBookmark.mockReset().mockResolvedValue(undefined);
    apiMocks.syncNotification.mockReset().mockResolvedValue({
      status: "synced",
      preference: null,
    });
    notificationServiceMocks.scheduleGroupBuyReminders
      .mockReset()
      .mockResolvedValue({
        status: "unavailable",
        reason: "missing-end-date",
      });
    notificationServiceMocks.scheduleGroupBuyOpeningReminders
      .mockReset()
      .mockResolvedValue({
        status: "unavailable",
        reason: "missing-start-date",
      });
    notificationServiceMocks.requestNotificationPermissions
      .mockReset()
      .mockResolvedValue(true);
    notificationServiceMocks.ensureNotificationPermission
      .mockReset()
      .mockResolvedValue(true);
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
    notificationPreferenceMocks.preferences.pushEnabled = true;
    notificationPreferenceMocks.preferences.deadlineRemindersEnabled = true;
    notificationPreferenceMocks.preferences.submissionApprovalEnabled = true;
    notificationPreferenceMocks.preferences.reminderDays = [1, 3, 7];
    authMocks.user = null;
    notificationServiceMocks.cancelAllScheduledNotifications.mockReset().mockResolvedValue(undefined);
    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
  });

  it("cancels device schedules on logout while preserving account reminder settings for login", async () => {
    authMocks.user = { id: "owner-a" };
    storage.values.set("@gonggu/notifications/v2/user%3Aowner-b", JSON.stringify([
      { groupBuyId: "group-b", reminderDays: [3], notificationId: "legacy-b-alarm", notificationIds: ["legacy-b-alarm"] },
    ]));
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled",
      notifications: [{ id: "owner-a-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    const mirrorCallsBeforeLogout = apiMocks.syncNotification.mock.calls.length;
    const signOut = vi.fn(async () => {
      expect(notificationServiceMocks.cancelAllScheduledNotifications).toHaveBeenCalledOnce();
      authMocks.user = null;
    });

    await act(async () => { await signOutLocalNotifications("owner-a", signOut); });
    expect(signOut).toHaveBeenCalledOnce();
    expect(apiMocks.syncNotification).toHaveBeenCalledTimes(mirrorCallsBeforeLogout);
    const saved = JSON.parse(storage.values.get("@gonggu/notifications/v2/user%3Aowner-a") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ groupBuyId: GROUP_BUY.id, reminderDays: [1], notificationId: null, notificationIds: [] });
    const otherAccount = JSON.parse(storage.values.get("@gonggu/notifications/v2/user%3Aowner-b") ?? "[]");
    expect(otherAccount[0]).toMatchObject({ groupBuyId: "group-b", reminderDays: [3], notificationIds: [] });
    notifications.rerender();
    await waitFor(() => expect(notifications.result.current.notifications).toEqual([]));

    authMocks.user = { id: "owner-a" };
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([GROUP_BUY]);
    apiMocks.fetchNotificationReminders.mockResolvedValue([{ groupBuyId: GROUP_BUY.id, type: "deadline", reminderDays: [1] }]);
    notificationServiceMocks.scheduleGroupBuyReminders.mockClear();
    notifications.rerender();
    await waitFor(() => expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledOnce());
  });

  it("drains and cancels a schedule that completes during logout", async () => {
    authMocks.user = { id: "owner-a" };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    let finish!: () => void;
    notificationServiceMocks.scheduleGroupBuyReminders.mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve({ status: "scheduled", notifications: [{ id: "late-alarm", triggerDate: new Date(Date.now() + 86_400_000) }] });
    }));
    const scheduling = notifications.result.current.setNotificationReminders(GROUP_BUY, [1]);
    await waitFor(() => expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledOnce());
    const signOut = vi.fn();
    const logout = signOutLocalNotifications("owner-a", signOut);
    expect(signOut).not.toHaveBeenCalled();
    await act(async () => { finish(); await scheduling; await logout; });
    expect(notificationServiceMocks.cancelScheduledNotification).toHaveBeenCalledWith("late-alarm");
    expect(notificationServiceMocks.cancelAllScheduledNotifications).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(notifications.result.current.notifications[0].notificationIds).toEqual([]);
  });

  it("retains authentication when device schedule cancellation fails and allows retry", async () => {
    notificationServiceMocks.cancelAllScheduledNotifications.mockRejectedValueOnce(new Error("native cancellation failed"));
    const signOut = vi.fn();
    await expect(signOutLocalNotifications("owner-a", signOut)).rejects.toThrow();
    expect(signOut).not.toHaveBeenCalled();
    await signOutLocalNotifications("owner-a", signOut);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it.each(["edit", "remove"] as const)("makes an interrupted reminder %s retryable when logout fails", async (action) => {
    const userId = `failed-logout-${action}`;
    authMocks.user = { id: userId };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled", notifications: [{ id: "old-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    let finishCancellation!: () => void;
    notificationServiceMocks.cancelScheduledNotifications.mockImplementationOnce((ids: string[]) => new Promise((resolve) => {
      finishCancellation = () => resolve({ cancelledIds: ids, failedIds: [] });
    }));
    const mutation = action === "edit"
      ? notifications.result.current.setNotificationReminders(GROUP_BUY, [3])
      : notifications.result.current.removeNotification(GROUP_BUY.id);
    await waitFor(() => expect(finishCancellation).toBeTypeOf("function"));
    notificationServiceMocks.cancelAllScheduledNotifications.mockRejectedValueOnce(new Error("native cancellation failed"));
    const signOut = vi.fn();
    await act(async () => {
      await expect(signOutLocalNotifications(userId, signOut)).rejects.toThrow("native cancellation failed");
      finishCancellation();
      await mutation;
    });
    expect(signOut).not.toHaveBeenCalled();
    const expectedState = { status: "failed", action: action === "edit" ? "enable" : "disable", retryable: true };
    expect(notifications.result.current.notifications[0]).toMatchObject({
      alertState: expectedState, notificationIds: ["old-alarm"], reminderDays: action === "edit" ? [3] : [1],
    });
    const saved = JSON.parse(storage.values.get(`@gonggu/notifications/v2/${encodeURIComponent(`user:${userId}`)}`) ?? "[]");
    expect(saved[0].alertState).toMatchObject(expectedState);
    expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledOnce();
    await act(async () => { await notifications.result.current.retryNotification(GROUP_BUY); });
    if (action === "edit") {
      expect(notifications.result.current.notifications[0].alertState?.status).toBe("enabled");
      expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenLastCalledWith(
        GROUP_BUY.id, GROUP_BUY.productName, GROUP_BUY.endDate, [3], { requestPermission: false },
      );
    } else {
      expect(notifications.result.current.notifications).toEqual([]);
    }
  });

  it("restores a completed write to the mounted snapshot when logout fails", async () => {
    authMocks.user = { id: "completed-write-owner" };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    let releaseWrite!: () => void;
    notificationServiceMocks.scheduleGroupBuyReminders.mockImplementationOnce(async () => {
      storage.writeGate = new Promise<void>((resolve) => { releaseWrite = resolve; });
      return { status: "scheduled", notifications: [{ id: "new-alarm", triggerDate: new Date(Date.now() + 86_400_000) }] };
    });
    const scheduling = notifications.result.current.setNotificationReminders(GROUP_BUY, [3]);
    await waitFor(() => expect(storage.attemptedWrites.some(({ key, value }) =>
      key === "@gonggu/notifications/v2/user%3Acompleted-write-owner" &&
      JSON.parse(value)[0]?.alertState?.status === "enabled",
    )).toBe(true));
    expect(notifications.result.current.notifications[0].alertState?.status).toBe("pending");
    storage.writeGate = null;
    notificationServiceMocks.cancelAllScheduledNotifications.mockRejectedValueOnce(new Error("native cancellation failed"));
    const signOut = vi.fn();
    const logout = signOutLocalNotifications("completed-write-owner", signOut);
    await act(async () => {
      releaseWrite();
      await scheduling;
      await expect(logout).rejects.toThrow("native cancellation failed");
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(notifications.result.current.notifications[0]).toMatchObject({
      alertState: { status: "enabled" }, notificationIds: ["new-alarm"], reminderDays: [3],
    });
  });

  it("does not schedule a queued old-account reminder after another account signs in", async () => {
    authMocks.user = { id: "owner-a" };
    let finishRefresh!: () => void;
    apiMocks.fetchNotificationReminders.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = () => resolve([]);
    }));
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledOnce());
    const scheduling = notifications.result.current.setNotificationReminders(GROUP_BUY, [1]);
    await act(async () => {
      await signOutLocalNotifications("owner-a", async () => { authMocks.user = { id: "owner-b" }; });
    });
    notifications.rerender();
    await act(async () => { finishRefresh(); await scheduling; });
    expect(notificationServiceMocks.scheduleGroupBuyReminders).not.toHaveBeenCalled();
    expect(notifications.result.current.notifications).toEqual([]);
  });

  it("does not restore cancelled alarm IDs when an old refresh completes after logout", async () => {
    authMocks.user = { id: "owner-a" };
    const remote = { groupBuyId: GROUP_BUY.id, type: "deadline", reminderDays: [1] };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled", notifications: [{ id: "old-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    let finishRefresh!: () => void;
    apiMocks.fetchNotificationReminders.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = () => resolve([remote]);
    }));
    const before = apiMocks.fetchNotificationReminders.mock.calls.length;
    act(() => { notifications.result.current.refresh(); });
    await waitFor(() => expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledTimes(before + 1));
    await act(async () => { await signOutLocalNotifications("owner-a", async () => { authMocks.user = null; }); });
    notifications.rerender();
    await act(async () => { finishRefresh(); });
    const saved = JSON.parse(storage.values.get("@gonggu/notifications/v2/user%3Aowner-a") ?? "[]");
    expect(saved[0].notificationIds).toEqual([]);

    authMocks.user = { id: "owner-a" };
    apiMocks.fetchNotificationReminders.mockResolvedValue([remote]);
    notificationServiceMocks.scheduleGroupBuyReminders.mockClear();
    notifications.rerender();
    await waitFor(() => expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledOnce());
  });

  it("turns on app push before saving a reminder when push is off", async () => {
    notificationPreferenceMocks.preferences.pushEnabled = false;
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await notifications.result.current.setNotificationReminders(GROUP_BUY, [3]);
    });

    expect(notificationServiceMocks.ensureNotificationPermission).toHaveBeenCalledOnce();
    expect(notificationPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      pushEnabled: true,
    });
  });

  it.each(["edit", "remove", "reschedule"] as const)("does not restore another reminder's cancelled IDs when a reminder %s finishes after logout", async (action) => {
    authMocks.user = { id: "late-edit-owner" };
    const otherDeal = { ...GROUP_BUY, id: "other-deal" };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockImplementation(async (groupBuyId: string) => ({
      status: "scheduled",
      notifications: [{ id: `${groupBuyId}-alarm`, triggerDate: new Date(Date.now() + 86_400_000) }],
    }));
    await act(async () => {
      await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]);
      await notifications.result.current.setNotificationReminders(otherDeal, [1]);
    });
    let finishCancellation!: () => void;
    notificationServiceMocks.cancelScheduledNotifications.mockImplementationOnce((ids: string[]) => new Promise((resolve) => {
      finishCancellation = () => resolve({ cancelledIds: ids, failedIds: [] });
    }));
    const edit = action === "edit"
      ? notifications.result.current.setNotificationReminders(GROUP_BUY, [3])
      : action === "remove"
        ? notifications.result.current.removeNotification(GROUP_BUY.id)
        : notifications.result.current.rescheduleNotifications(notificationPreferenceMocks.preferences);
    await waitFor(() => expect(finishCancellation).toBeTypeOf("function"));
    await act(async () => {
      await signOutLocalNotifications("late-edit-owner", async () => { authMocks.user = null; });
    });
    notifications.rerender();
    await act(async () => { finishCancellation(); await edit; });
    const saved = JSON.parse(storage.values.get("@gonggu/notifications/v2/user%3Alate-edit-owner") ?? "[]");
    expect(saved.find((entry: { groupBuyId: string }) => entry.groupBuyId === otherDeal.id).notificationIds).toEqual([]);

    authMocks.user = { id: "late-edit-owner" };
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([GROUP_BUY, otherDeal]);
    apiMocks.fetchNotificationReminders.mockResolvedValue([GROUP_BUY, otherDeal].map((item) => ({
      groupBuyId: item.id, type: "deadline", reminderDays: [1],
    })));
    notificationServiceMocks.scheduleGroupBuyReminders.mockClear();
    notifications.rerender();
    await waitFor(() => expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledWith(otherDeal.id, otherDeal.productName, otherDeal.endDate, [1], { requestPermission: false }));
  });

  it("drains an in-flight reminder write before logout clears disk and mounted snapshots", async () => {
    authMocks.user = { id: "writing-owner" };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled", notifications: [{ id: "old-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    let releaseWrite!: () => void;
    storage.writeGate = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const writes = storage.writeAttempts;
    const edit = notifications.result.current.setNotificationReminders(GROUP_BUY, [3]);
    await waitFor(() => expect(storage.writeAttempts).toBeGreaterThan(writes));
    storage.writeGate = null;
    const signOut = vi.fn(async () => undefined);
    const logout = signOutLocalNotifications("writing-owner", signOut);
    try {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(signOut).not.toHaveBeenCalled();
    } finally {
      await act(async () => { releaseWrite(); await edit; await logout; });
    }
    const saved = JSON.parse(storage.values.get("@gonggu/notifications/v2/user%3Awriting-owner") ?? "[]");
    expect(saved[0]).toMatchObject({ notificationIds: [], notificationId: null, reminderDays: [3] });
    expect(notifications.result.current.notifications[0]).toMatchObject({ notificationIds: [], notificationId: null });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it.each([
    ["edit", false, false], ["remove", false, false],
    ["edit", true, false], ["remove", true, false],
    ["edit", true, true], ["remove", true, true],
  ] as const)("preserves an accepted reminder %s across relogin with sync failure %s and fetch failure %s", async (action, syncFails, fetchFails) => {
    const userId = `intent-owner-${action}-${syncFails}-${fetchFails}`;
    let serverDays: number[] = [];
    let failSync = false;
    let failFetch = false;
    apiMocks.syncNotification.mockImplementation(async (_id: string, days: readonly number[]) => {
      if (failSync) return { status: "failed" };
      serverDays = [...days];
      return { status: "synced", preference: null };
    });
    apiMocks.fetchNotificationReminders.mockImplementation(async () => failFetch ? null
      : serverDays.length ? [{ groupBuyId: GROUP_BUY.id, type: "deadline", reminderDays: serverDays }] : []);
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([GROUP_BUY]);
    authMocks.user = { id: userId };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled", notifications: [{ id: "old-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    await waitFor(() => expect(serverDays).toEqual([1]));
    failSync = syncFails;
    failFetch = fetchFails;
    let finishCancellation!: () => void;
    notificationServiceMocks.cancelScheduledNotifications.mockImplementationOnce((ids: string[]) => new Promise((resolve) => {
      finishCancellation = () => resolve({ cancelledIds: ids, failedIds: [] });
    }));
    const mutation = action === "edit"
      ? notifications.result.current.setNotificationReminders(GROUP_BUY, [3])
      : notifications.result.current.removeNotification(GROUP_BUY.id);
    await waitFor(() => expect(finishCancellation).toBeTypeOf("function"));
    await act(async () => { await signOutLocalNotifications(userId, async () => { authMocks.user = null; }); });
    notifications.rerender();
    await act(async () => { finishCancellation(); await mutation; });
    const saved = JSON.parse(storage.values.get(`@gonggu/notifications/v2/${encodeURIComponent(`user:${userId}`)}`) ?? "[]");
    expect(saved.every((entry: { notificationIds: string[] }) => entry.notificationIds.length === 0)).toBe(true);

    const schedulesBeforeRelogin = notificationServiceMocks.scheduleGroupBuyReminders.mock.calls.length;
    authMocks.user = { id: userId };
    notifications.rerender();
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    if (action === "edit") {
      expect(notifications.result.current.getNotificationReminderDays(GROUP_BUY.id)).toEqual([3]);
      expect(notificationServiceMocks.scheduleGroupBuyReminders.mock.calls.length).toBeGreaterThan(schedulesBeforeRelogin);
      expect(notifications.result.current.notifications[0]?.notificationIds).toHaveLength(1);
    } else {
      expect(notifications.result.current.notifications).toEqual([]);
      expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledTimes(schedulesBeforeRelogin);
    }
  });

  it("journals a new reminder choice without waiting for an older remote sync during logout", async () => {
    const userId = "stalled-mirror-owner";
    authMocks.user = { id: userId };
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    let finishOldMirror!: () => void;
    apiMocks.syncNotification.mockImplementationOnce(() => new Promise((resolve) => {
      finishOldMirror = () => resolve({ status: "synced", preference: null });
    }));
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValue({
      status: "scheduled", notifications: [{ id: "old-alarm", triggerDate: new Date(Date.now() + 86_400_000) }],
    });
    await act(async () => { await notifications.result.current.setNotificationReminders(GROUP_BUY, [1]); });
    await waitFor(() => expect(finishOldMirror).toBeTypeOf("function"));
    let finishCancellation!: () => void;
    notificationServiceMocks.cancelScheduledNotifications.mockImplementationOnce((ids: string[]) => new Promise((resolve) => {
      finishCancellation = () => resolve({ cancelledIds: ids, failedIds: [] });
    }));
    const edit = notifications.result.current.setNotificationReminders(GROUP_BUY, [3]);
    await waitFor(() => expect(finishCancellation).toBeTypeOf("function"));
    const signOut = vi.fn(async () => { authMocks.user = null; });
    await act(async () => { await signOutLocalNotifications(userId, signOut); });
    expect(signOut).toHaveBeenCalledOnce();
    const outboxKey = `@gonggu/notifications/outbox/v1/${encodeURIComponent(`user:${userId}`)}`;
    expect(JSON.parse(storage.values.get(outboxKey) ?? "[]")[0]?.reminderDays).toEqual([3]);
    let finishNewMirror!: () => void;
    apiMocks.syncNotification.mockImplementationOnce(() => new Promise((resolve) => {
      finishNewMirror = () => resolve({ status: "failed", preference: null });
    }));
    await act(async () => { finishOldMirror(); finishCancellation(); await edit; });
    await waitFor(() => expect(finishNewMirror).toBeTypeOf("function"));
    expect(JSON.parse(storage.values.get(outboxKey) ?? "[]")[0]?.reminderDays).toEqual([3]);
    await act(async () => { finishNewMirror(); });
  });

  it("rejects a queued old-session reminder even when the same account signs back in", async () => {
    authMocks.user = { id: "returning-owner" };
    let finishRefresh!: () => void;
    apiMocks.fetchNotificationReminders.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = () => resolve([]);
    }));
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(finishRefresh).toBeTypeOf("function"));
    const scheduling = notifications.result.current.setNotificationReminders(GROUP_BUY, [1]);
    await act(async () => { await signOutLocalNotifications("returning-owner", async () => { authMocks.user = null; }); });
    notifications.rerender();
    authMocks.user = { id: "returning-owner" };
    notifications.rerender();
    await act(async () => { finishRefresh(); await scheduling; });
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    expect(notificationServiceMocks.scheduleGroupBuyReminders).not.toHaveBeenCalled();
    expect(notificationServiceMocks.ensureNotificationPermission).not.toHaveBeenCalled();
    expect(notifications.result.current.notifications).toEqual([]);
  });

  it("does not enable push when an old reminder permission prompt finishes after logout", async () => {
    authMocks.user = { id: "permission-owner" };
    notificationPreferenceMocks.preferences.pushEnabled = false;
    notificationPreferenceMocks.updatePreferences.mockClear();
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    let grantPermission!: () => void;
    notificationServiceMocks.ensureNotificationPermission.mockImplementationOnce(() => new Promise((resolve) => {
      grantPermission = () => resolve(true);
    }));
    const scheduling = notifications.result.current.setNotificationReminders(GROUP_BUY, [1]);
    await waitFor(() => expect(grantPermission).toBeTypeOf("function"));
    await act(async () => { await signOutLocalNotifications("permission-owner", async () => { authMocks.user = null; }); });
    notifications.rerender();
    await act(async () => { grantPermission(); await scheduling; });
    expect(notificationPreferenceMocks.updatePreferences).not.toHaveBeenCalled();
    expect(notificationServiceMocks.scheduleGroupBuyReminders).not.toHaveBeenCalled();
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

  it("저장된 북마크를 해제할 때 서버에도 해제 상태를 보낸다", async () => {
    storage.values.set("@gonggu/bookmarks/v1", JSON.stringify([GROUP_BUY]));
    const bookmarks = renderHook(() => useBookmarks());
    await waitFor(() => expect(bookmarks.result.current.ready).toBe(true));

    act(() => bookmarks.result.current.toggleBookmark(GROUP_BUY));

    await waitFor(() => {
      expect(apiMocks.syncBookmark).toHaveBeenLastCalledWith(
        GROUP_BUY.id,
        false,
      );
    });
    expect(bookmarks.result.current.bookmarks).toEqual([]);
  });

  it("빠른 북마크 토글의 마지막 상태를 서버에 보낸다", async () => {
    const bookmarks = renderHook(() => useBookmarks());
    await waitFor(() => expect(bookmarks.result.current.ready).toBe(true));

    act(() => {
      bookmarks.result.current.toggleBookmark(GROUP_BUY);
      bookmarks.result.current.toggleBookmark(GROUP_BUY);
    });

    await waitFor(() => {
      expect(apiMocks.syncBookmark).toHaveBeenLastCalledWith(
        GROUP_BUY.id,
        false,
      );
    });
    expect(bookmarks.result.current.bookmarks).toEqual([]);
  });

  it("동시에 열린 화면들이 같은 북마크 상태를 사용한다", async () => {
    const reels = renderHook(() => useBookmarks());
    const detail = renderHook(() => useBookmarks());
    await waitFor(() => {
      expect(reels.result.current.ready).toBe(true);
      expect(detail.result.current.ready).toBe(true);
    });

    act(() => reels.result.current.toggleBookmark(GROUP_BUY));
    await waitFor(() => {
      expect(detail.result.current.isBookmarked(GROUP_BUY.id)).toBe(true);
    });

    act(() => detail.result.current.toggleBookmark(GROUP_BUY));
    await waitFor(() => {
      expect(reels.result.current.isBookmarked(GROUP_BUY.id)).toBe(false);
      expect(apiMocks.syncBookmark).toHaveBeenLastCalledWith(
        GROUP_BUY.id,
        false,
      );
    });
  });

  it("느린 서버 동기화가 다음 북마크 상태의 로컬 저장을 막지 않는다", async () => {
    let releaseFirstSync!: () => void;
    apiMocks.syncBookmark.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirstSync = resolve;
        }),
    );
    const bookmarks = renderHook(() => useBookmarks());
    await waitFor(() => expect(bookmarks.result.current.ready).toBe(true));

    act(() => bookmarks.result.current.toggleBookmark(GROUP_BUY));
    await waitFor(() => {
      expect(apiMocks.syncBookmark).toHaveBeenCalledWith(GROUP_BUY.id, true);
      expect(
        JSON.parse(storage.values.get("@gonggu/bookmarks/v1") ?? "[]"),
      ).toHaveLength(1);
    });

    act(() => bookmarks.result.current.toggleBookmark(GROUP_BUY));
    await waitFor(() => {
      expect(
        JSON.parse(storage.values.get("@gonggu/bookmarks/v1") ?? "[]"),
      ).toEqual([]);
    });

    releaseFirstSync();
    await waitFor(() => {
      expect(apiMocks.syncBookmark).toHaveBeenLastCalledWith(
        GROUP_BUY.id,
        false,
      );
    });
  });

  it("개인 활동 삭제 중 끝난 북마크 hydration이 데이터를 되살리지 않는다", async () => {
    let releaseHydration!: () => void;
    const hydrationGate = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });
    apiMocks.fetchGroupBuysByIds.mockImplementationOnce(async () => {
      await hydrationGate;
      return [GROUP_BUY];
    });
    storage.values.set(
      "@gonggu/bookmarks/v1",
      JSON.stringify([
        { id: GROUP_BUY.id, productName: GROUP_BUY.productName },
      ]),
    );
    const bookmarks = renderHook(() => useBookmarks());
    await waitFor(() =>
      expect(apiMocks.fetchGroupBuysByIds).toHaveBeenCalled(),
    );

    await clearLocalUserData();

    expect(storage.values.has("@gonggu/bookmarks/v1")).toBe(false);
    expect(bookmarks.result.current.bookmarks).toEqual([]);

    releaseHydration();
    await waitFor(() => expect(bookmarks.result.current.ready).toBe(true));
    expect(storage.values.has("@gonggu/bookmarks/v1")).toBe(false);
    expect(bookmarks.result.current.bookmarks).toEqual([]);
  });

  it("만 13세 모드에서는 최근 본 공구를 로컬에 기록하지 않는다", async () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age13"));
    storage.values.set(
      "@gonggu/recent-views/v1",
      JSON.stringify([{ ...GROUP_BUY, productName: "과거 최근 본 공구" }]),
    );
    const recentViews = renderHook(() => useRecentViews());
    await waitFor(() => expect(recentViews.result.current.ready).toBe(true));

    act(() => recentViews.result.current.recordView(GROUP_BUY));

    expect(recentViews.result.current.recentViews).toEqual([]);
    expect(apiMocks.fetchGroupBuysByIds).not.toHaveBeenCalled();
  });

  it("만 13세 모드에서는 개인 활동 캐시를 읽거나 변경하지 않는다", async () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age13"));
    storage.values.set("@gonggu/bookmarks/v1", JSON.stringify([GROUP_BUY]));
    storage.values.set(
      "@gonggu/wish-items/v1",
      JSON.stringify([{ id: "old-wish" }]),
    );
    storage.values.set(
      "@gonggu/notifications/v2/guest",
      JSON.stringify([{ groupBuyId: GROUP_BUY.id }]),
    );

    const bookmarks = renderHook(() => useBookmarks());
    const notifications = renderHook(() => useNotifications());
    const wishItems = renderHook(() => useWishItems());
    await waitFor(() => {
      expect(bookmarks.result.current.ready).toBe(true);
      expect(notifications.result.current.ready).toBe(true);
      expect(wishItems.result.current.ready).toBe(true);
    });

    await act(async () => {
      bookmarks.result.current.toggleBookmark(GROUP_BUY);
      wishItems.result.current.recordWishItem({
        submissionId: "new-wish",
        groupBuyId: null,
        instagramUrl: "https://www.instagram.com/p/example/",
        productName: "새 위시",
        thumbnailUrl: null,
        mediaType: null,
      });
      await notifications.result.current.toggleNotification(GROUP_BUY);
    });

    expect(bookmarks.result.current.bookmarks).toEqual([]);
    expect(notifications.result.current.notifications).toEqual([]);
    expect(wishItems.result.current.wishItems).toEqual([]);
    expect(storage.writeAttempts).toBe(0);
    expect(apiMocks.syncBookmark).not.toHaveBeenCalled();
    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).not.toHaveBeenCalled();
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

  it("초기 로드 중 화면이 사라져도 다음 화면의 기록을 보존한다", async () => {
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
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    storage.values.set("@gonggu/recent-views/v1", JSON.stringify([storedDeal]));
    storage.readPlans.push({
      snapshot: JSON.stringify([storedDeal]),
      gate: readGate,
    });

    const firstScreen = renderHook(() => useRecentViews());
    await waitFor(() => {
      expect(storage.readPlans).toHaveLength(0);
    });
    firstScreen.unmount();

    const secondScreen = renderHook(() => useRecentViews());
    act(() => {
      secondScreen.result.current.recordView(newlyViewedDeal);
    });
    await act(async () => {
      releaseRead();
    });

    await waitFor(() => {
      expect(secondScreen.result.current.ready).toBe(true);
      expect(
        secondScreen.result.current.recentViews.map((deal) => deal.id),
      ).toEqual(["group-buy-new", "group-buy-existing"]);
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
      ).toEqual(["group-buy-new", "group-buy-existing"]);
    });
  });

  it("지연된 쓰기 중 다른 화면의 기록도 최신순으로 보존한다", async () => {
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

    let releaseWrite!: () => void;
    storage.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writesBeforeRecord = storage.writeAttempts;
    act(() => {
      firstScreen.result.current.recordView(viewedDealB);
    });
    await waitFor(() => {
      expect(storage.writeAttempts).toBe(writesBeforeRecord + 1);
    });

    act(() => {
      secondScreen.result.current.recordView(viewedDealC);
    });
    await act(async () => {
      releaseWrite();
      storage.writeGate = null;
    });

    await waitFor(() => {
      const expectedIds = ["group-buy-c", "group-buy-b", "group-buy-a"];
      expect(
        firstScreen.result.current.recentViews.map((deal) => deal.id),
      ).toEqual(expectedIds);
      expect(
        secondScreen.result.current.recentViews.map((deal) => deal.id),
      ).toEqual(expectedIds);
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
      ).toEqual(expectedIds);
    });
  });

  it("기록 전 저장소 읽기가 실패해도 다음 화면에서 복구한다", async () => {
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
    storage.values.set(
      "@gonggu/recent-views/v1",
      JSON.stringify([storedDealA]),
    );
    const recentViews = renderHook(() => useRecentViews());
    await waitFor(() => {
      expect(recentViews.result.current.ready).toBe(true);
    });

    storage.nextGetItemError = new Error("temporary read failure");
    await act(async () => {
      recentViews.result.current.recordView(viewedDealB);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(storage.nextGetItemError).toBeNull();
    expect(
      (
        JSON.parse(
          storage.values.get("@gonggu/recent-views/v1") ?? "[]",
        ) as Array<{ id: string }>
      ).map((deal) => deal.id),
    ).toEqual(["group-buy-a"]);
    expect(
      recentViews.result.current.recentViews.map((deal) => deal.id),
    ).toEqual(["group-buy-b", "group-buy-a"]);

    recentViews.unmount();
    const remountedRecentViews = renderHook(() => useRecentViews());

    await waitFor(() => {
      expect(remountedRecentViews.result.current.ready).toBe(true);
      expect(
        remountedRecentViews.result.current.recentViews.map((deal) => deal.id),
      ).toEqual(["group-buy-b", "group-buy-a"]);
      expect(
        (
          JSON.parse(
            storage.values.get("@gonggu/recent-views/v1") ?? "[]",
          ) as Array<{ id: string }>
        ).map((deal) => deal.id),
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
    const ranking = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(ranking.result.current.ready).toBe(true);
    });

    let releaseWrite!: () => void;
    storage.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let togglePromise!: Promise<unknown>;
    act(() => {
      togglePromise = ranking.result.current.toggleNotification(GROUP_BUY);
    });

    const reels = renderHook(() => useNotifications());

    await act(async () => {
      releaseWrite();
      storage.writeGate = null;
      await togglePromise;
    });

    await waitFor(() => {
      expect(reels.result.current.ready).toBe(true);
      expect(reels.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
    });
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
    storage.values.set("search:recent", JSON.stringify(["과거 검색어"]));
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
    expect(storage.values.has("search:recent")).toBe(false);
    expect(
      storage.values.has("@gonggu/notification-preferences/v1/guest"),
    ).toBe(false);
    expect(
      storage.values.has("@gonggu/notification-preferences/v1/guest/pending"),
    ).toBe(false);
  });

  it("serializes different group-buy writes without dropping either entry", async () => {
    notificationServiceMocks.scheduleGroupBuyReminders
      .mockResolvedValueOnce({
        status: "scheduled",
        notifications: [
          {
            id: "native-a",
            groupBuyId: "group-buy-a",
            productName: "공구 A",
            triggerDate: new Date("2026-07-20T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        status: "scheduled",
        notifications: [
          {
            id: "native-b",
            groupBuyId: "group-buy-b",
            productName: "공구 B",
            triggerDate: new Date("2026-07-21T00:00:00.000Z"),
          },
        ],
      });
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await Promise.all([
        notifications.result.current.toggleNotification({
          ...GROUP_BUY,
          id: "group-buy-a",
          productName: "공구 A",
          endDate: "2026-07-27T00:00:00.000Z",
        }),
        notifications.result.current.toggleNotification({
          ...GROUP_BUY,
          id: "group-buy-b",
          productName: "공구 B",
          endDate: "2026-07-28T00:00:00.000Z",
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
      notificationServiceMocks.scheduleGroupBuyReminders,
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
        submissionApprovalEnabled: true,
        marketingPushEnabled: false,
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

  it("reconciles stored reminders without requesting native permission", async () => {
    storage.values.set(
      "@gonggu/notifications/v2/guest",
      JSON.stringify([
        {
          ...GROUP_BUY,
          groupBuyId: GROUP_BUY.id,
          endDate: "2026-07-20T12:00:00.000Z",
          notificationId: "deadline-1",
          notificationIds: ["deadline-1"],
          scheduledFor: "2026-07-19T12:00:00.000Z",
          scheduledForDates: ["2026-07-19T12:00:00.000Z"],
          reminderDays: [3],
          reminderPreference: { type: "deadline", reminderDays: [3] },
          alertState: {
            status: "enabled",
            notificationId: "deadline-1",
            notificationIds: ["deadline-1"],
            scheduledFor: "2026-07-19T12:00:00.000Z",
            scheduledForDates: ["2026-07-19T12:00:00.000Z"],
          },
          createdAt: "2026-07-17T00:00:00.000Z",
        },
      ]),
    );
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "unavailable",
      reason: "permission-denied",
    });
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    await act(async () => {
      await notifications.result.current.rescheduleNotifications({
        pushEnabled: true,
        deadlineRemindersEnabled: true,
        submissionApprovalEnabled: true,
        marketingPushEnabled: false,
        reminderDays: [3],
        followedInfluencers: [],
        followedBrands: [],
      });
    });

    expect(notificationServiceMocks.scheduleGroupBuyReminders).toHaveBeenCalledWith(
      GROUP_BUY.id,
      GROUP_BUY.productName,
      "2026-07-20T12:00:00.000Z",
      [3],
      { requestPermission: false },
    );
  });

  it("예약 결과를 관심 저장 상태와 분리해 노출한다", async () => {
    const scheduledFor = "2026-07-16T17:00:00.000Z";
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "scheduled",
      notifications: [
        {
          id: "native-notification-1",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          triggerDate: new Date(scheduledFor),
        },
      ],
    });
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      await notifications.result.current.toggleNotification({
        ...GROUP_BUY,
        endDate: "2026-07-23T00:00:00.000Z",
      });
    });

    expect(notifications.result.current.isNotifying(GROUP_BUY.id)).toBe(true);
    expect(
      notifications.result.current.getNotificationState(GROUP_BUY.id),
    ).toEqual({
      status: "enabled",
      notificationId: "native-notification-1",
      scheduledFor,
      notificationIds: ["native-notification-1"],
      scheduledForDates: [scheduledFor],
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
      reason: "missing-end-date",
    });
  });

  it("requests native permission from every notification enable path", async () => {
    notificationPreferenceMocks.preferences.pushEnabled = false;
    const notifications = renderHook(() => useNotifications());
    const secondItem = { ...GROUP_BUY, id: "group-buy-2" };

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
    });

    await act(async () => {
      await notifications.result.current.setNotificationReminders(
        GROUP_BUY,
        [3],
      );
      await notifications.result.current.toggleNotification(secondItem);
      await notifications.result.current.toggleNotification(secondItem);
    });

    expect(
      notificationServiceMocks.ensureNotificationPermission,
    ).toHaveBeenCalledTimes(2);
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

  it("schedules and mirrors only the reminder days selected for the item", async () => {
    authMocks.user = { id: "user-1" };
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "scheduled",
      notifications: [
        {
          id: "deadline-3",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          reminderDay: 3,
          triggerDate: new Date("2026-07-24T00:00:00.000Z"),
        },
      ],
    });
    const item = {
      ...GROUP_BUY,
      endDate: "2026-07-27T00:00:00.000Z",
    };
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await notifications.result.current.setNotificationReminders(item, [3]);
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledWith(item.id, item.productName, item.endDate, [3]);
    expect(
      notifications.result.current.getNotificationReminderDays(item.id),
    ).toEqual([3]);
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        item.id,
        [3],
        "user-1",
      );
    });
  });

  it("stores, schedules, and mirrors opening reminders with their shared time", async () => {
    authMocks.user = { id: "user-1" };
    notificationServiceMocks.scheduleGroupBuyOpeningReminders.mockResolvedValueOnce(
      {
        status: "scheduled",
        notifications: [
          {
            id: "opening-3",
            groupBuyId: GROUP_BUY.id,
            productName: GROUP_BUY.productName,
            reminderDay: 3,
            reminderType: "opening",
            triggerDate: new Date("2026-07-24T06:30:00.000Z"),
          },
        ],
      },
    );
    const item = {
      ...GROUP_BUY,
      startDate: "2026-07-27T00:00:00.000Z",
      endDate: "2026-08-03T00:00:00.000Z",
    };
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await notifications.result.current.setNotificationReminders(item, {
        type: "opening",
        reminderDays: [0, 3],
        reminderTimeMinutes: 15 * 60 + 30,
      });
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyOpeningReminders,
    ).toHaveBeenCalledWith(
      item.id,
      item.productName,
      item.startDate,
      [0, 3],
      15 * 60 + 30,
    );
    expect(
      notifications.result.current.getNotificationReminderPreference(item.id),
    ).toEqual({
      type: "opening",
      reminderDays: [0, 3],
      reminderTimeMinutes: 15 * 60 + 30,
    });
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        item.id,
        {
          type: "opening",
          reminderDays: [0, 3],
          reminderTimeMinutes: 15 * 60 + 30,
        },
        "user-1",
      );
    });
  });

  it("uses global push and per-item days when the legacy deadline preference is disabled", async () => {
    authMocks.user = { id: "user-1" };
    notificationPreferenceMocks.preferences.deadlineRemindersEnabled = false;
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "scheduled",
      notifications: [
        {
          id: "deadline-5",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          reminderDay: 5,
          triggerDate: new Date("2026-07-22T00:00:00.000Z"),
        },
        {
          id: "deadline-2",
          groupBuyId: GROUP_BUY.id,
          productName: GROUP_BUY.productName,
          reminderDay: 2,
          triggerDate: new Date("2026-07-25T00:00:00.000Z"),
        },
      ],
    });
    const item = {
      ...GROUP_BUY,
      endDate: "2026-07-27T00:00:00.000Z",
    };
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await notifications.result.current.setNotificationReminders(item, [2, 5]);
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledWith(item.id, item.productName, item.endDate, [2, 5]);
    expect(
      notifications.result.current.getNotificationReminderDays(item.id),
    ).toEqual([2, 5]);
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        item.id,
        [2, 5],
        "user-1",
      );
    });
  });

  it("restores authenticated reminder selections from the server", async () => {
    authMocks.user = { id: "user-1" };
    const item = {
      ...GROUP_BUY,
      endDate: "2099-07-27T00:00:00.000Z",
    };
    notificationServiceMocks.scheduleGroupBuyReminders.mockResolvedValueOnce({
      status: "scheduled",
      notifications: [
        {
          id: "restored-deadline-3",
          groupBuyId: item.id,
          productName: item.productName,
          reminderDay: 3,
          triggerDate: new Date("2026-07-24T00:00:00.000Z"),
        },
      ],
    });
    apiMocks.fetchNotificationReminders.mockResolvedValue([
      {
        groupBuyId: item.id,
        reminderDays: [1, 3],
        updatedAt: "2026-07-20T00:00:00.000Z",
      },
    ]);
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([item]);
    const notifications = renderHook(() => useNotifications());
    const secondSubscriber = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
      expect(secondSubscriber.result.current.ready).toBe(true);
      expect(
        notifications.result.current.getNotificationReminderDays(item.id),
      ).toEqual([1, 3]);
    });
    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledWith(item.id, item.productName, item.endDate, [1, 3], {
      requestPermission: false,
    });
    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledTimes(1);
  });

  it("prunes an expired remote reminder intent on startup", async () => {
    authMocks.user = { id: "user-1" };
    const expiredItem = {
      ...GROUP_BUY,
      endDate: "2020-07-27T00:00:00.000Z",
    };
    apiMocks.fetchNotificationReminders.mockResolvedValue([
      {
        groupBuyId: expiredItem.id,
        type: "deadline",
        reminderDays: [1],
        reminderTimeMinutes: null,
        updatedAt: "2020-07-20T00:00:00.000Z",
      },
    ]);
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([expiredItem]);
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    expect(notifications.result.current.isNotifying(expiredItem.id)).toBe(
      false,
    );
    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        expiredItem.id,
        [],
        "user-1",
      );
    });
  });

  it("serializes a startup refresh before a newer item reminder mutation", async () => {
    authMocks.user = { id: "user-1" };
    const item = {
      ...GROUP_BUY,
      endDate: "2099-07-27T00:00:00.000Z",
    };
    let releaseRemote!: (
      value: Array<{
        groupBuyId: string;
        reminderDays: Array<1 | 3 | 7>;
        updatedAt: string;
      }>,
    ) => void;
    apiMocks.fetchNotificationReminders.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseRemote = resolve;
      }),
    );
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([item]);
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledOnce();
    });
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = notifications.result.current.setNotificationReminders(
        item,
        [3],
      );
    });
    await act(async () => {
      releaseRemote([
        {
          groupBuyId: item.id,
          reminderDays: [1],
          updatedAt: "2026-07-20T00:00:00.000Z",
        },
      ]);
      await mutation;
    });

    expect(
      notifications.result.current.getNotificationReminderDays(item.id),
    ).toEqual([3]);
    await waitFor(() => {
      expect(apiMocks.syncNotification).toHaveBeenLastCalledWith(
        item.id,
        [3],
        "user-1",
      );
    });
  });

  it("recovers a native schedule left pending by an interrupted app process", async () => {
    authMocks.user = { id: "user-1" };
    const item = {
      ...GROUP_BUY,
      endDate: "2099-07-27T00:00:00.000Z",
    };
    storage.values.set(
      "@gonggu/notifications/v2/user%3Auser-1",
      JSON.stringify([
        {
          ...item,
          groupBuyId: item.id,
          reminderDays: [1],
          notificationId: null,
          notificationIds: [],
          scheduledFor: null,
          scheduledForDates: [],
          alertState: { status: "pending", action: "enable" },
          createdAt: "2026-07-20T00:00:00.000Z",
        },
      ]),
    );
    storage.values.set(
      "@gonggu/notifications/server-migrated/v1/user%3Auser-1",
      "true",
    );
    apiMocks.fetchNotificationReminders.mockResolvedValue([
      {
        groupBuyId: item.id,
        reminderDays: [1],
        updatedAt: "2026-07-20T00:00:00.000Z",
      },
    ]);
    apiMocks.fetchGroupBuysByIds.mockResolvedValue([item]);
    const notifications = renderHook(() => useNotifications());

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));

    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledWith(item.id, item.productName, item.endDate, [1], {
      requestPermission: false,
    });
  });

  it("reconciles existing native IDs when item reminder days change", async () => {
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
      await notifications.result.current.setNotificationReminders(item, [3]);
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
    notificationServiceMocks.scheduleGroupBuyReminders.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSchedule = resolve;
      }),
    );
    const notifications = renderHook(() => useNotifications());
    const item = {
      ...GROUP_BUY,
      endDate: "2026-07-23T00:00:00.000Z",
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
        notificationServiceMocks.scheduleGroupBuyReminders,
      ).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      releaseSchedule({
        status: "scheduled",
        notifications: [
          {
            id: "native-notification-rapid",
            groupBuyId: item.id,
            productName: item.productName,
            triggerDate: new Date("2026-07-16T17:00:00.000Z"),
          },
        ],
      });
      await Promise.all([firstToggle, secondToggle]);
    });

    expect(
      notificationServiceMocks.scheduleGroupBuyReminders,
    ).toHaveBeenCalledTimes(1);
    expect(
      notificationServiceMocks.cancelScheduledNotifications,
    ).toHaveBeenCalledWith(["native-notification-rapid"]);
    expect(notifications.result.current.isNotifying(item.id)).toBe(false);
  });

  it("keeps failed server mirrors in a retryable outbox", async () => {
    authMocks.user = { id: "user-1" };
    apiMocks.syncNotification.mockReset().mockResolvedValue({
      status: "failed",
    });
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
        [1, 3, 7],
        "user-1",
      );
    });
    expect(
      JSON.parse(
        storage.values.get("@gonggu/notifications/outbox/v1/user%3Auser-1") ??
          "[]",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupBuyId: GROUP_BUY.id,
          reminderDays: [1, 3, 7],
        }),
      ]),
    );

    apiMocks.syncNotification.mockResolvedValue({
      status: "synced",
      preference: null,
    });
    await act(async () => {
      notifications.result.current.refresh();
      await waitFor(() => {
        expect(
          JSON.parse(
            storage.values.get(
              "@gonggu/notifications/outbox/v1/user%3Auser-1",
            ) ?? "[]",
          ),
        ).toEqual([]);
      });
    });
  });

  it.each([true, false])(
    "honors a legacy enabled=%s reminder outbox entry while server sync fails",
    async (enabled) => {
      const userId = `legacy-outbox-${enabled}`;
      const encodedNamespace = encodeURIComponent(`user:${userId}`);
      const outboxKey = `@gonggu/notifications/outbox/v1/${encodedNamespace}`;
      const reminder = {
        ...GROUP_BUY,
        endDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      };
      const scheduledFor = new Date(Date.now() + 9 * 86_400_000).toISOString();
      authMocks.user = { id: userId };
      storage.values.set(
        `@gonggu/notifications/server-migrated/v1/${encodedNamespace}`,
        "true",
      );
      storage.values.set(
        `@gonggu/notifications/v2/${encodedNamespace}`,
        JSON.stringify([{
          ...reminder,
          groupBuyId: reminder.id,
          reminderDays: [1, 3, 7],
          notificationId: "legacy-alarm",
          notificationIds: ["legacy-alarm"],
          scheduledFor,
          scheduledForDates: [scheduledFor],
          alertState: {
            status: "enabled",
            notificationId: "legacy-alarm",
            notificationIds: ["legacy-alarm"],
            scheduledFor,
            scheduledForDates: [scheduledFor],
          },
          createdAt: new Date().toISOString(),
        }]),
      );
      storage.values.set(outboxKey, JSON.stringify([{
        groupBuyId: reminder.id,
        enabled,
        updatedAt: new Date().toISOString(),
      }]));
      apiMocks.syncNotification.mockResolvedValue({ status: "failed" });
      apiMocks.fetchGroupBuysByIds.mockResolvedValue([reminder]);
      apiMocks.fetchNotificationReminders.mockResolvedValue([{
        groupBuyId: reminder.id,
        type: "deadline",
        reminderDays: [1, 3, 7],
      }]);

      const notifications = renderHook(() => useNotifications());
      await waitFor(() => expect(notifications.result.current.ready).toBe(true));

      expect(apiMocks.syncNotification).toHaveBeenCalledWith(
        reminder.id,
        enabled ? [1, 3, 7] : [],
        userId,
      );
      expect(JSON.parse(storage.values.get(outboxKey) ?? "[]")).toEqual([
        expect.objectContaining({ groupBuyId: reminder.id, enabled }),
      ]);
      if (enabled) {
        expect(notifications.result.current.getNotificationReminderDays(reminder.id)).toEqual([1, 3, 7]);
        expect(notifications.result.current.notifications[0]?.notificationIds).toEqual(["legacy-alarm"]);
        expect(notificationServiceMocks.cancelScheduledNotifications).not.toHaveBeenCalledWith(["legacy-alarm"]);
      } else {
        expect(notifications.result.current.notifications).toEqual([]);
        expect(notificationServiceMocks.cancelScheduledNotifications).toHaveBeenCalledWith(["legacy-alarm"]);
      }
    },
  );

  it("keeps concurrent reminder mirror intents for different items", async () => {
    authMocks.user = { id: "user-1" };
    apiMocks.syncNotification.mockReset().mockResolvedValue({
      status: "failed",
    });
    const notifications = renderHook(() => useNotifications());
    const first = {
      ...GROUP_BUY,
      id: "group-buy-a",
      endDate: "2026-07-27T00:00:00.000Z",
    };
    const second = {
      ...GROUP_BUY,
      id: "group-buy-b",
      endDate: "2026-07-28T00:00:00.000Z",
    };

    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      await Promise.all([
        notifications.result.current.setNotificationReminders(first, [1]),
        notifications.result.current.setNotificationReminders(second, [3]),
      ]);
    });
    await waitFor(() => {
      expect(
        JSON.parse(
          storage.values.get("@gonggu/notifications/outbox/v1/user%3Auser-1") ??
            "[]",
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupBuyId: first.id,
            reminderDays: [1],
          }),
          expect.objectContaining({
            groupBuyId: second.id,
            reminderDays: [3],
          }),
        ]),
      );
    });
  });

  it("keeps queued reminder intents bound to their owner while another account signs in", async () => {
    const outboxKey = "@gonggu/notifications/outbox/v1/user%3Auser-a";
    const first = {
      groupBuyId: "group-buy-a",
      reminderDays: [1],
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
    const second = {
      groupBuyId: "group-buy-b",
      reminderDays: [3],
      updatedAt: "2026-07-20T00:01:00.000Z",
    };
    storage.values.set(outboxKey, JSON.stringify([first, second]));
    authMocks.user = { id: "user-a" };
    let finishFirst!: (result: { status: "synced"; preference: null }) => void;
    apiMocks.syncNotification
      .mockReset()
      .mockImplementation(async (_id, _reminder, expectedUserId) =>
        expectedUserId === authMocks.user?.id
          ? { status: "synced", preference: null }
          : { status: "failed" },
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      );
    const notifications = renderHook(() => useNotifications());
    await waitFor(() => expect(apiMocks.syncNotification).toHaveBeenCalledOnce());

    authMocks.user = { id: "user-b" };
    notifications.rerender();
    await waitFor(() => expect(notifications.result.current.ready).toBe(true));
    await act(async () => {
      finishFirst({ status: "synced", preference: null });
    });

    await waitFor(() => {
      expect(JSON.parse(storage.values.get(outboxKey) ?? "[]")).toEqual([second]);
      expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledTimes(2);
    });
    expect(apiMocks.syncNotification).toHaveBeenNthCalledWith(
      1,
      first.groupBuyId,
      [1],
      "user-a",
    );
    expect(apiMocks.syncNotification).toHaveBeenNthCalledWith(
      2,
      second.groupBuyId,
      [3],
      "user-a",
    );
    expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledWith("user-a");
    expect(apiMocks.fetchNotificationReminders).toHaveBeenCalledWith("user-b");
    expect(notifications.result.current.notifications).toEqual([]);
    expect(
      JSON.parse(
        storage.values.get("@gonggu/notifications/outbox/v1/user%3Auser-b") ?? "[]",
      ),
    ).toEqual([]);

    authMocks.user = { id: "user-a" };
    notifications.rerender();
    await waitFor(() => {
      expect(notifications.result.current.ready).toBe(true);
      expect(JSON.parse(storage.values.get(outboxKey) ?? "[]")).toEqual([]);
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
    expect(
      JSON.parse(
        storage.values.get("@gonggu/notifications/v2/user%3Auser-1") ?? "null",
      ),
    ).toEqual([]);
    expect(
      JSON.parse(storage.values.get("@gonggu/notifications/v2/guest") ?? "[]"),
    ).toHaveLength(1);
  });
});
