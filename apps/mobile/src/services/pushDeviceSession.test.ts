import { beforeEach, describe, expect, it, vi } from "vitest";

const { callEdgeFunction, storage } = vi.hoisted(() => ({ callEdgeFunction: vi.fn(), storage: new Map<string, string>() }));
vi.mock("../lib/postgrest-client", () => ({ callEdgeFunction }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
} }));

import {
  capturePushRegistrationGuard,
  registerPushDeviceToken,
  signOutPushDevice,
} from "./pushDeviceSession";

describe("push device logout", () => {
  beforeEach(async () => {
    storage.clear();
    callEdgeFunction.mockReset().mockResolvedValue({ data: { unregistered: true } });
  });

  it("releases only this installation token before ending authentication", async () => {
    await registerPushDeviceToken("ExpoPushToken[this-device]", "user-a-token", () => true);
    const signOut = vi.fn(async () => {
      expect(callEdgeFunction).toHaveBeenLastCalledWith(
        "register-push-token",
        { action: "unregister", token: "ExpoPushToken[this-device]", provider: "expo" },
        expect.objectContaining({ authToken: "user-a-token" }),
      );
    });
    await signOutPushDevice("user-a-token", signOut);
    expect(signOut).toHaveBeenCalledOnce();
    expect(callEdgeFunction.mock.calls.every(([, body]) => !body.preferences)).toBe(true);
  });

  it("waits for an old registration and cancels delayed token acquisition on logout", async () => {
    let finish!: () => void;
    callEdgeFunction.mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve({ data: { registered: true } });
    }));
    const oldGuard = capturePushRegistrationGuard(() => true);
    const registration = registerPushDeviceToken("ExpoPushToken[this-device]", "user-a-token", oldGuard);
    await vi.waitFor(() => expect(callEdgeFunction).toHaveBeenCalledOnce());
    const signOut = vi.fn();
    const logout = signOutPushDevice("user-a-token", signOut);
    expect(oldGuard()).toBe(false);
    expect(capturePushRegistrationGuard(() => true)()).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    finish();
    await registration;
    await logout;
    expect(callEdgeFunction).toHaveBeenCalledTimes(2);
    expect(oldGuard()).toBe(false);
    expect(capturePushRegistrationGuard(() => true)()).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("retains authentication for retry if device revocation fails", async () => {
    await registerPushDeviceToken("ExpoPushToken[this-device]", "user-a-token", () => true);
    callEdgeFunction.mockRejectedValueOnce(new Error("offline"));
    const signOut = vi.fn();
    await expect(signOutPushDevice("user-a-token", signOut)).rejects.toThrow();
    expect(signOut).not.toHaveBeenCalled();
    expect(capturePushRegistrationGuard(() => true)()).toBe(true);
    await signOutPushDevice("user-a-token", signOut);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("bounds logout while registration is stalled and permits retry after it settles", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    callEdgeFunction.mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve({ data: { registered: true } });
    }));
    const registration = registerPushDeviceToken("ExpoPushToken[this-device]", "user-a-token", () => true);
    await Promise.resolve();
    await Promise.resolve();
    const signOut = vi.fn();
    let outcome = "pending";
    const logout = signOutPushDevice("user-a-token", signOut).then(
      () => { outcome = "resolved"; },
      () => { outcome = "rejected"; },
    );
    try {
      await vi.advanceTimersByTimeAsync(10_001);
      expect(outcome).toBe("rejected");
      expect(signOut).not.toHaveBeenCalled();
      expect(callEdgeFunction).toHaveBeenCalledOnce();
      expect(capturePushRegistrationGuard(() => true)()).toBe(true);
    } finally {
      finish();
      await registration;
      await logout;
      vi.useRealTimers();
    }
    await signOutPushDevice("user-a-token", signOut);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
