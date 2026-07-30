import { describe, expect, it, vi } from "vitest";

import { cleanupRestrictedAudienceSession } from "./restrictedAudienceCleanup";

describe("cleanupRestrictedAudienceSession", () => {
  it("clears remote push, auth, stable anonymous id, and user caches", async () => {
    const disableRemotePush = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const clearSessionId = vi.fn().mockResolvedValue(undefined);
    const clearLocalUserData = vi.fn().mockResolvedValue(undefined);

    await cleanupRestrictedAudienceSession({
      accessToken: "access-token",
      userId: "user-123",
      disableRemotePush,
      signOut,
      clearSessionId,
      clearLocalUserData,
    });

    expect(disableRemotePush).toHaveBeenCalledWith("access-token");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearSessionId).toHaveBeenCalledTimes(1);
    expect(clearLocalUserData).toHaveBeenCalledWith("user:user-123");
    expect(clearLocalUserData).toHaveBeenCalledWith("guest");
  });

  it("continues local cleanup when remote push removal fails", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const clearSessionId = vi.fn().mockResolvedValue(undefined);
    const clearLocalUserData = vi.fn().mockResolvedValue(undefined);

    await cleanupRestrictedAudienceSession({
      accessToken: "expired-token",
      userId: null,
      disableRemotePush: vi.fn().mockRejectedValue(new Error("expired")),
      signOut,
      clearSessionId,
      clearLocalUserData,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearSessionId).toHaveBeenCalledTimes(1);
    expect(clearLocalUserData).toHaveBeenCalledWith("guest");
  });

  it("does not initialize sign-out for a first-time restricted guest", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const clearSessionId = vi.fn().mockResolvedValue(undefined);
    const clearLocalUserData = vi.fn().mockResolvedValue(undefined);

    await cleanupRestrictedAudienceSession({
      accessToken: null,
      userId: null,
      disableRemotePush: vi.fn().mockResolvedValue(undefined),
      signOut,
      clearSessionId,
      clearLocalUserData,
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(clearSessionId).toHaveBeenCalledTimes(1);
    expect(clearLocalUserData).toHaveBeenCalledWith("guest");
  });

  it("starts local sign-out without waiting for remote push cleanup", async () => {
    let finishRemoteCleanup!: () => void;
    const disableRemotePush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRemoteCleanup = resolve;
        }),
    );
    const signOut = vi.fn().mockResolvedValue(undefined);

    const cleanup = cleanupRestrictedAudienceSession({
      accessToken: "access-token",
      userId: "user-123",
      disableRemotePush,
      signOut,
      clearSessionId: vi.fn().mockResolvedValue(undefined),
      clearLocalUserData: vi.fn().mockResolvedValue(undefined),
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    finishRemoteCleanup();
    await cleanup;
  });
});
