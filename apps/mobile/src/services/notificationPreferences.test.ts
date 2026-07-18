import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
const callEdgeFunction = vi.hoisted(() => vi.fn());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferencesStorageKey,
  loadNotificationPreferences,
  loadRemoteNotificationPreferences,
  normalizeNotificationPreferences,
  saveNotificationPreferences,
  syncNotificationPreferences,
} from "./notificationPreferences";

describe("notification preferences", () => {
  beforeEach(() => {
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    storage.removeItem.mockReset().mockResolvedValue(undefined);
    callEdgeFunction.mockReset().mockResolvedValue({
      data: { preferences: DEFAULT_NOTIFICATION_PREFERENCES },
    });
  });

  it("keeps every notification category off until the user opts in", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toMatchObject({
      pushEnabled: false,
      deadlineRemindersEnabled: false,
      newSubmissionsEnabled: false,
    });
    expect(normalizeNotificationPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
  });

  it("normalizes reminder days and bounded follow targets", () => {
    expect(
      normalizeNotificationPreferences({
        pushEnabled: false,
        deadlineRemindersEnabled: true,
        newSubmissionsEnabled: false,
        reminderDays: [7, 3, 7, 2, "1"],
        followedInfluencers: [" @Seller.One ", "seller.one", "bad handle!"],
        followedBrands: ["  Brand  A ", "brand a", ""],
      }),
    ).toEqual({
      pushEnabled: false,
      deadlineRemindersEnabled: true,
      newSubmissionsEnabled: false,
      reminderDays: [3, 7],
      followedInfluencers: ["seller.one"],
      followedBrands: ["Brand A"],
    });
  });

  it("repairs an empty reminder selection to the supported defaults", () => {
    expect(
      normalizeNotificationPreferences({ reminderDays: [] }).reminderDays,
    ).toEqual([1, 3, 7]);
  });

  it("keeps namespace storage isolated and repairs malformed JSON", async () => {
    expect(getNotificationPreferencesStorageKey("user:abc/123")).toBe(
      "@gonggu/notification-preferences/v1/user%3Aabc%2F123",
    );
    storage.getItem.mockResolvedValueOnce("not-json");

    await expect(loadNotificationPreferences("guest")).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );

    const next = normalizeNotificationPreferences({ pushEnabled: false });
    await saveNotificationPreferences("guest", next);
    expect(storage.setItem).toHaveBeenCalledWith(
      "@gonggu/notification-preferences/v1/guest",
      JSON.stringify(next),
    );
  });

  it("syncs only normalized preferences without exposing tokens", async () => {
    const preferences = normalizeNotificationPreferences({
      reminderDays: [7, 1, 7],
      followedInfluencers: ["@Seller"],
    });

    await syncNotificationPreferences("access-token", preferences);

    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      { preferences },
      expect.objectContaining({
        authToken: "access-token",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("loads and normalizes authenticated server preferences", async () => {
    callEdgeFunction.mockResolvedValueOnce({
      data: {
        preferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          pushEnabled: false,
          reminderDays: [7, 1, 7],
        },
      },
    });

    await expect(
      loadRemoteNotificationPreferences("access-token"),
    ).resolves.toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      pushEnabled: false,
      reminderDays: [1, 7],
    });
    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      { action: "read" },
      expect.objectContaining({
        authToken: "access-token",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
