import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  state: "inactive",
  // eslint-disable-next-line no-unused-vars
  appStateListener: null as ((status: string) => void) | null,
  // eslint-disable-next-line no-unused-vars
  onlineListener: null as ((online: boolean) => void) | null,
  removeAppStateListener: vi.fn(),
  unsubscribeOnline: vi.fn(),
  refreshAuth: vi.fn(async (status: string) => {
    void status;
  }),
  flush: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return runtimeMocks.state;
    },
    addEventListener: vi.fn(
      (
        _event: string,
        listener: NonNullable<typeof runtimeMocks.appStateListener>,
      ) => {
        runtimeMocks.appStateListener = listener;
        return { remove: runtimeMocks.removeAppStateListener };
      },
    ),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  onlineManager: {
    subscribe: vi.fn(
      (listener: NonNullable<typeof runtimeMocks.onlineListener>) => {
        runtimeMocks.onlineListener = listener;
        return runtimeMocks.unsubscribeOnline;
      },
    ),
  },
}));

vi.mock("../lib/supabase", () => ({
  syncSupabaseAuthAutoRefresh: runtimeMocks.refreshAuth,
}));

vi.mock("./popularitySignalOutbox", () => ({
  flushPopularitySignalOutbox: runtimeMocks.flush,
}));

import { startPopularitySignalRecovery } from "./popularitySignalRecovery";

describe("startPopularitySignalRecovery", () => {
  beforeEach(() => {
    runtimeMocks.state = "inactive";
    runtimeMocks.appStateListener = null;
    runtimeMocks.onlineListener = null;
    runtimeMocks.removeAppStateListener.mockReset();
    runtimeMocks.unsubscribeOnline.mockReset();
    runtimeMocks.refreshAuth.mockReset().mockResolvedValue(undefined);
    runtimeMocks.flush.mockReset().mockResolvedValue(undefined);
  });

  it("백그라운드에서 active로 돌아오면 인증 갱신 뒤 신호를 flush한다", async () => {
    let releaseActiveAuth!: () => void;
    runtimeMocks.refreshAuth
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseActiveAuth = resolve;
          }),
      );
    const dispose = startPopularitySignalRecovery();
    await vi.waitFor(() => {
      expect(runtimeMocks.refreshAuth).toHaveBeenCalledWith("inactive");
    });
    expect(runtimeMocks.flush).not.toHaveBeenCalled();

    runtimeMocks.state = "active";
    runtimeMocks.appStateListener?.("active");

    await vi.waitFor(() => {
      expect(runtimeMocks.refreshAuth).toHaveBeenLastCalledWith("active");
    });
    expect(runtimeMocks.flush).not.toHaveBeenCalled();

    releaseActiveAuth();
    await vi.waitFor(() => {
      expect(runtimeMocks.flush).toHaveBeenCalledTimes(1);
    });

    dispose();
    expect(runtimeMocks.removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.unsubscribeOnline).toHaveBeenCalledTimes(1);
  });

  it("온라인 복구는 앱이 active일 때만 신호를 flush한다", async () => {
    startPopularitySignalRecovery();
    await vi.waitFor(() => {
      expect(runtimeMocks.refreshAuth).toHaveBeenCalledWith("inactive");
    });

    runtimeMocks.onlineListener?.(false);
    runtimeMocks.onlineListener?.(true);
    expect(runtimeMocks.flush).not.toHaveBeenCalled();

    runtimeMocks.state = "active";
    runtimeMocks.onlineListener?.(true);

    await vi.waitFor(() => {
      expect(runtimeMocks.flush).toHaveBeenCalledTimes(1);
    });
  });

  it("dispose 뒤 끝난 인증 갱신은 신호를 flush하지 않는다", async () => {
    let releaseAuth!: () => void;
    runtimeMocks.state = "active";
    runtimeMocks.refreshAuth.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseAuth = resolve;
        }),
    );
    const dispose = startPopularitySignalRecovery();
    await vi.waitFor(() => {
      expect(runtimeMocks.refreshAuth).toHaveBeenCalledWith("active");
    });

    dispose();
    releaseAuth();
    await Promise.resolve();
    await Promise.resolve();

    expect(runtimeMocks.flush).not.toHaveBeenCalled();
  });
});
