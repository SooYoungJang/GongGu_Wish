import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackgroundPushRegistration } from "./useBackgroundPushRegistration";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "../services/notificationPreferences";

const { callEdgeFunction, platform } = vi.hoisted(() => ({
  callEdgeFunction: vi.fn(),
  platform: { OS: "android" },
}));

vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));
vi.mock("react-native", () => ({
  Linking: { openSettings: vi.fn() },
  Platform: platform,
}));
vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { extra: { eas: { projectId: "project-123" } } },
  },
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({
    data: "ExpoPushToken[test-token]",
  }),
}));

type RegistrationOptions = Parameters<typeof useBackgroundPushRegistration>[0];
const eligibleOptions: RegistrationOptions = {
  accessToken: "old-access-token",
  canAuthenticate: true,
  authLoading: false,
  preferencesReady: true,
  pushEnabled: true,
  userId: "user-a",
};
const savedPreferences: NotificationPreferences = {
  pushEnabled: true,
  deadlineRemindersEnabled: true,
  submissionApprovalEnabled: true,
  marketingPushEnabled: true,
  reminderDays: [1],
  followedInfluencers: ["favorite_seller"],
  followedBrands: ["favorite-brand"],
};

function RegistrationProbe(props: RegistrationOptions) {
  useBackgroundPushRegistration(props);
  return null;
}

describe.each(["ios", "android"])("background push registration on %s", (os) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let remotePreferences: NotificationPreferences;
  let pendingRegistrations: Array<() => void>;

  beforeEach(() => {
    platform.OS = os;
    remotePreferences = globalThis.structuredClone(savedPreferences);
    pendingRegistrations = [];
    callEdgeFunction.mockReset().mockImplementation(
      async (_name: string, body: { preferences?: NotificationPreferences }) => {
        if (body.preferences) {
          remotePreferences = globalThis.structuredClone(body.preferences);
          return { data: { preferencesSynced: true, registered: false } };
        }
        return new Promise((resolve) => {
          pendingRegistrations.push(() => {
            resolve({ data: { registered: true, provider: "expo" } });
          });
        });
      },
    );
  });

  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
  });

  async function mount() {
    await act(async () => {
      renderer = TestRenderer.create(<RegistrationProbe {...eligibleOptions} />);
    });
    await vi.waitFor(() => expect(pendingRegistrations).toHaveLength(1));
  }

  async function completeRegistration(index: number) {
    await act(async () => {
      pendingRegistrations[index]();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }

  it("preserves all saved preferences when an old registration completes after token rotation", async () => {
    await mount();

    await act(async () => {
      renderer!.update(
        <RegistrationProbe {...eligibleOptions} accessToken="fresh-access-token" />,
      );
    });
    await vi.waitFor(() => expect(pendingRegistrations).toHaveLength(2));

    // The new session finishes first; the stale request must not undo it.
    await completeRegistration(1);
    await completeRegistration(0);

    expect(remotePreferences).toEqual(savedPreferences);
    expect(callEdgeFunction).toHaveBeenCalledTimes(2);
    expect(callEdgeFunction).toHaveBeenNthCalledWith(
      2,
      "register-push-token",
      { token: "ExpoPushToken[test-token]", provider: "expo" },
      { authToken: "fresh-access-token" },
    );
  });

  it("does not reset preferences when an allowed app tree unmounts during registration", async () => {
    await mount();
    act(() => renderer!.unmount());
    renderer = undefined;

    await completeRegistration(0);

    expect(remotePreferences).toEqual(savedPreferences);
    expect(callEdgeFunction).toHaveBeenCalledOnce();
  });

  it("still disables an in-flight registration when audience policy becomes restricted", async () => {
    await mount();
    await act(async () => {
      renderer!.update(
        <RegistrationProbe {...eligibleOptions} canAuthenticate={false} />,
      );
    });

    await completeRegistration(0);

    expect(remotePreferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(callEdgeFunction).toHaveBeenCalledTimes(2);
    expect(callEdgeFunction).toHaveBeenLastCalledWith(
      "register-push-token",
      { preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      {
        authToken: "old-access-token",
        signal: expect.any(AbortSignal),
      },
    );
  });
});
