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
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../services/notificationPreferences";

describe("NotificationPreferencesProvider", () => {
  let current: NotificationPreferencesContextValue | null = null;

  function Probe() {
    current = useNotificationPreferences();
    return null;
  }

  async function settle() {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  }

  function persistStorageInMemory() {
    const values = new Map<string, string>();
    storage.getItem.mockImplementation((key: string) =>
      Promise.resolve(values.get(key) ?? null),
    );
    storage.setItem.mockImplementation((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    });
    storage.removeItem.mockImplementation((key: string) => {
      values.delete(key);
      return Promise.resolve();
    });
    return values;
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
          submissionApprovalEnabled: true,
          marketingPushEnabled: false,
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
          submissionApprovalEnabled: false,
          marketingPushEnabled: false,
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
      submissionApprovalEnabled: true,
      marketingPushEnabled: false,
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

  it("keeps the latest opt-out when an earlier save finishes after token rotation", async () => {
    const stored = persistStorageInMemory();
    const storageKey = "@gonggu/notification-preferences/v1/user%3Arotating";
    let server = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      pushEnabled: true,
    };
    let finishEarlierSave!: () => void;
    const earlierSave = new Promise<void>((resolve) => {
      finishEarlierSave = resolve;
    });
    callEdgeFunction.mockImplementation(
      async (
        _name: string,
        body: { action?: string; preferences?: typeof server },
        options: { authToken: string },
      ) => {
        if (body.action === "read") {
          return { data: { preferences: { ...server } } };
        }
        if (options.authToken === "token-A") await earlierSave;
        server = { ...body.preferences! };
        return { data: { preferencesSynced: true, registered: false } };
      },
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="token-A"
          namespace="user:rotating"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    expect(current?.preferences.pushEnabled).toBe(true);

    let firstUpdate!: Promise<unknown>;
    await act(async () => {
      firstUpdate = current!.updatePreferences({ marketingPushEnabled: true });
      await settle();
    });
    expect(JSON.parse(stored.get(`${storageKey}/pending`)!).pushEnabled).toBe(
      true,
    );

    await act(async () => {
      renderer.update(
        <NotificationPreferencesProvider
          authToken="token-B"
          namespace="user:rotating"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    let latestUpdate!: Promise<unknown>;
    await act(async () => {
      latestUpdate = current!.updatePreferences({ pushEnabled: false });
      await settle();
    });
    expect(current?.preferences.pushEnabled).toBe(false);

    await act(async () => {
      finishEarlierSave();
      await Promise.all([firstUpdate, latestUpdate]);
      await settle();
    });

    expect(server.pushEnabled).toBe(false);
    expect(server.marketingPushEnabled).toBe(true);
    expect(current?.preferences.pushEnabled).toBe(false);
    expect(JSON.parse(stored.get(storageKey)!).pushEnabled).toBe(false);
    expect(stored.has(`${storageKey}/pending`)).toBe(false);
    renderer.unmount();
  });

  it("retains a failed latest opt-out after older token saves and retries finish", async () => {
    const stored = persistStorageInMemory();
    const storageKey = "@gonggu/notification-preferences/v1/user%3Aretry";
    let server = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      pushEnabled: true,
    };
    let finishEarlierSaves!: () => void;
    const earlierSaves = new Promise<void>((resolve) => {
      finishEarlierSaves = resolve;
    });
    callEdgeFunction.mockImplementation(
      async (
        _name: string,
        body: { action?: string; preferences?: typeof server },
      ) => {
        if (body.action === "read") {
          return { data: { preferences: { ...server } } };
        }
        if (body.preferences!.pushEnabled) {
          await earlierSaves;
          server = { ...body.preferences! };
          return { data: { preferencesSynced: true, registered: false } };
        }
        throw new Error("offline while saving the opt-out");
      },
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="token-A"
          namespace="user:retry"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    let firstUpdate!: Promise<unknown>;
    await act(async () => {
      firstUpdate = current!.updatePreferences({ marketingPushEnabled: true });
      await settle();
    });
    await act(async () => {
      renderer.update(
        <NotificationPreferencesProvider
          authToken="token-B"
          namespace="user:retry"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    let latestUpdate!: Promise<unknown>;
    await act(async () => {
      latestUpdate = current!.updatePreferences({ pushEnabled: false });
      await settle();
    });

    await act(async () => {
      finishEarlierSaves();
      await Promise.all([firstUpdate, latestUpdate]);
      await settle();
    });

    expect(current?.preferences.pushEnabled).toBe(false);
    expect(JSON.parse(stored.get(storageKey)!).pushEnabled).toBe(false);
    const pending = stored.get(`${storageKey}/pending`);
    expect(pending).toBeDefined();
    expect(JSON.parse(pending!).pushEnabled).toBe(false);
    renderer.unmount();
  });

  it("keeps the next account isolated while the previous account save finishes", async () => {
    const stored = persistStorageInMemory();
    const userAKey = "@gonggu/notification-preferences/v1/user%3Aaccount-A";
    const userBKey = "@gonggu/notification-preferences/v1/user%3Aaccount-B";
    const servers = new Map([
      [
        "account-A-token",
        { ...DEFAULT_NOTIFICATION_PREFERENCES, pushEnabled: true },
      ],
      [
        "account-B-token",
        {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          followedInfluencers: ["account.b"],
        },
      ],
    ]);
    let finishAccountA!: () => void;
    const accountASave = new Promise<void>((resolve) => {
      finishAccountA = resolve;
    });
    callEdgeFunction.mockImplementation(
      async (
        _name: string,
        body: {
          action?: string;
          preferences?: typeof DEFAULT_NOTIFICATION_PREFERENCES;
        },
        options: { authToken: string },
      ) => {
        if (body.action === "read") {
          return {
            data: { preferences: { ...servers.get(options.authToken)! } },
          };
        }
        if (options.authToken === "account-A-token") await accountASave;
        servers.set(options.authToken, { ...body.preferences! });
        return { data: { preferencesSynced: true, registered: false } };
      },
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationPreferencesProvider
          authToken="account-A-token"
          namespace="user:account-A"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    let accountAUpdate!: Promise<unknown>;
    await act(async () => {
      accountAUpdate = current!.updatePreferences({ marketingPushEnabled: true });
      await settle();
    });
    await act(async () => {
      renderer.update(
        <NotificationPreferencesProvider
          authToken="account-B-token"
          namespace="user:account-B"
        >
          <Probe />
        </NotificationPreferencesProvider>,
      );
      await settle();
    });
    expect(current?.preferences.pushEnabled).toBe(false);
    expect(current?.preferences.followedInfluencers).toEqual(["account.b"]);

    let accountBUpdate!: Promise<unknown>;
    await act(async () => {
      accountBUpdate = current!.updatePreferences({ marketingPushEnabled: true });
      await settle();
    });
    await act(async () => {
      finishAccountA();
      await Promise.all([accountAUpdate, accountBUpdate]);
      await settle();
    });

    expect(current?.preferences).toMatchObject({
      pushEnabled: false,
      marketingPushEnabled: true,
      followedInfluencers: ["account.b"],
    });
    expect(servers.get("account-B-token")).toEqual(current?.preferences);
    expect(JSON.parse(stored.get(userBKey)!)).toEqual(current?.preferences);
    expect(JSON.parse(stored.get(userAKey)!)).toMatchObject({
      pushEnabled: true,
      marketingPushEnabled: true,
    });
    renderer.unmount();
  });
});
