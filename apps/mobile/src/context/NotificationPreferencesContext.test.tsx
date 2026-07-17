import React from "react";
import TestRenderer, { act } from "react-test-renderer";
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
  NotificationPreferencesProvider,
  useNotificationPreferences,
  type NotificationPreferencesContextValue,
} from "./NotificationPreferencesContext";

describe("NotificationPreferencesProvider", () => {
  let current: NotificationPreferencesContextValue | null = null;

  function Probe() {
    current = useNotificationPreferences();
    return null;
  }

  beforeEach(() => {
    current = null;
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    storage.removeItem.mockReset().mockResolvedValue(undefined);
    callEdgeFunction.mockReset().mockResolvedValue({
      data: {
        preferences: {
          pushEnabled: true,
          deadlineRemindersEnabled: true,
          newSubmissionsEnabled: true,
          reminderDays: [1, 3, 7],
          followedInfluencers: [],
          followedBrands: [],
        },
      },
    });
  });

  it("hydrates authenticated users from the server before publishing ready", async () => {
    callEdgeFunction.mockResolvedValueOnce({
      data: {
        preferences: {
          pushEnabled: false,
          deadlineRemindersEnabled: true,
          newSubmissionsEnabled: false,
          reminderDays: [3],
          followedInfluencers: ["server.seller"],
          followedBrands: [],
        },
      },
    });

    await act(async () => {
      TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="access-token"
          namespace="user:remote"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.ready).toBe(true);
    expect(current?.preferences.pushEnabled).toBe(false);
    expect(current?.preferences.followedInfluencers).toEqual(["server.seller"]);
    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      { action: "read" },
      expect.objectContaining({
        authToken: "access-token",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("retries a pending local opt-out before accepting remote state", async () => {
    const local = {
      pushEnabled: true,
      deadlineRemindersEnabled: true,
      newSubmissionsEnabled: true,
      reminderDays: [1, 3, 7],
      followedInfluencers: [],
      followedBrands: [],
    };
    const pending = { ...local, pushEnabled: false, reminderDays: [3] };
    storage.getItem.mockImplementation((key: string) =>
      Promise.resolve(
        key.endsWith("/pending")
          ? JSON.stringify(pending)
          : JSON.stringify(local),
      ),
    );
    callEdgeFunction.mockResolvedValueOnce({
      data: { preferencesSynced: true, registered: false },
    });

    await act(async () => {
      TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="access-token"
          namespace="user:pending"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.ready).toBe(true);
    expect(current?.preferences.pushEnabled).toBe(false);
    expect(current?.preferences.reminderDays).toEqual([3]);
    expect(callEdgeFunction).toHaveBeenCalledWith(
      "register-push-token",
      { preferences: pending },
      expect.objectContaining({ authToken: "access-token" }),
    );
    expect(callEdgeFunction).not.toHaveBeenCalledWith(
      "register-push-token",
      { action: "read" },
      expect.anything(),
    );
    expect(storage.removeItem).toHaveBeenCalledWith(
      "@gonggu/notification-preferences/v1/user%3Apending/pending",
    );
  });

  it("loads a namespace and publishes optimistic persisted updates", async () => {
    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ pushEnabled: false, reminderDays: [3] }),
    );
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationPreferencesProvider namespace="user:one">
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.ready).toBe(true);
    expect(current?.preferences.pushEnabled).toBe(false);
    expect(current?.preferences.reminderDays).toEqual([3]);

    await act(async () => {
      await current?.updatePreferences({
        pushEnabled: true,
        reminderDays: [1, 7],
      });
    });

    expect(current?.preferences.pushEnabled).toBe(true);
    expect(current?.preferences.reminderDays).toEqual([1, 7]);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      "@gonggu/notification-preferences/v1/user%3Aone",
      expect.stringContaining('"pushEnabled":true'),
    );
    renderer!.unmount();
  });

  it("toggles normalized influencer and brand targets", async () => {
    await act(async () => {
      TestRenderer.create(
        <NotificationPreferencesProvider namespace="guest">
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await current?.toggleInfluencer("@Seller.One");
      await current?.toggleBrand(" Brand A ");
    });
    expect(current?.preferences.followedInfluencers).toEqual(["seller.one"]);
    expect(current?.preferences.followedBrands).toEqual(["Brand A"]);

    await act(async () => {
      await current?.toggleInfluencer("SELLER.ONE");
      await current?.toggleBrand("brand a");
    });
    expect(current?.preferences.followedInfluencers).toEqual([]);
    expect(current?.preferences.followedBrands).toEqual([]);
  });

  it("serializes remote writes so rapid updates cannot arrive out of order", async () => {
    await act(async () => {
      TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="access-token"
          namespace="user:rapid"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    callEdgeFunction.mockReset();
    let resolveFirstWrite!: (value: unknown) => void;
    callEdgeFunction
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstWrite = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: { preferencesSynced: true, registered: false },
      });

    let firstUpdate!: Promise<unknown>;
    let secondUpdate!: Promise<unknown>;
    await act(async () => {
      firstUpdate = current!.updatePreferences({ pushEnabled: false });
      secondUpdate = current!.updatePreferences({ reminderDays: [3] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callEdgeFunction).toHaveBeenCalledTimes(1);
    resolveFirstWrite({
      data: { preferencesSynced: true, registered: false },
    });
    await act(async () => {
      await Promise.all([firstUpdate, secondUpdate]);
    });

    expect(callEdgeFunction).toHaveBeenCalledTimes(2);
    expect(callEdgeFunction.mock.calls[1]?.[1]).toEqual({
      preferences: expect.objectContaining({
        pushEnabled: false,
        reminderDays: [3],
      }),
    });
  });
});
