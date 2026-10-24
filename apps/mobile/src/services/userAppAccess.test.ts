import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: "active",
  online: true,
  stateListener: null as ((state: string) => void) | null,
  onlineListener: null as ((online: boolean) => void) | null,
  remove: vi.fn(),
  unsubscribe: vi.fn(),
  post: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() { return mocks.state; },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.stateListener = listener;
      return { remove: mocks.remove };
    },
  },
}));
vi.mock("@tanstack/react-query", () => ({
  onlineManager: {
    isOnline: () => mocks.online,
    subscribe: (listener: (online: boolean) => void) => {
      mocks.onlineListener = listener;
      return mocks.unsubscribe;
    },
  },
}));
vi.mock("../lib/postgrest-client", () => ({ postgrestPost: mocks.post }));

import { startUserAppAccessTracking } from "./userAppAccess";

describe("authenticated app access recording", () => {
  let stop: (() => void) | undefined;
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.state = "active";
    mocks.online = true;
    mocks.stateListener = null;
    mocks.onlineListener = null;
    mocks.post.mockResolvedValue(null);
  });
  afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });

  it("records the active account using both transport and server identity guards", async () => {
    stop = startUserAppAccessTracking("user-a");
    expect(mocks.post).toHaveBeenCalledWith(
      "rpc/record_user_app_access", { p_expected_user_id: "user-a" },
      { expectedUserId: "user-a", signal: expect.any(AbortSignal) },
    );
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("records foreground returns but ignores repeated active and background events", async () => {
    mocks.state = "background";
    stop = startUserAppAccessTracking("user-a");
    expect(mocks.post).not.toHaveBeenCalled();
    mocks.stateListener!("active");
    await flush();
    mocks.stateListener!("active");
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.stateListener!("inactive");
    mocks.stateListener!("background");
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.stateListener!("active");
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("waits for connectivity and retries only while foregrounded", async () => {
    mocks.online = false;
    stop = startUserAppAccessTracking("user-a");
    expect(mocks.post).not.toHaveBeenCalled();
    mocks.online = true;
    mocks.onlineListener!(true);
    await flush();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.stateListener!("background");
    mocks.onlineListener!(true);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("cancels stale requests on background, account changes and disposal", () => {
    mocks.post.mockImplementation(() => new Promise(() => {}));
    stop = startUserAppAccessTracking("user-a");
    const oldSignal = mocks.post.mock.calls[0][2].signal as AbortSignal;
    mocks.onlineListener!(true);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.stateListener!("background");
    expect(oldSignal.aborted).toBe(true);
    mocks.stateListener!("active");
    const activeSignal = mocks.post.mock.calls[1][2].signal as AbortSignal;
    const staleListener = mocks.stateListener!;
    stop();
    expect(activeSignal.aborted).toBe(true);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    staleListener("background"); staleListener("active");
    expect(mocks.post).toHaveBeenCalledTimes(2);
    stop = startUserAppAccessTracking("user-b");
    expect(mocks.post.mock.calls[2][1]).toEqual({ p_expected_user_id: "user-b" });
  });

  it("bounds a hung request without blocking a subsequent foreground return", () => {
    mocks.post.mockImplementation(() => new Promise(() => {}));
    stop = startUserAppAccessTracking("user-a");
    const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
    vi.advanceTimersByTime(15_000);
    expect(signal.aborted).toBe(true);
    mocks.stateListener!("background"); mocks.stateListener!("active");
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("does not let an old completion clear the newer account-bound request", async () => {
    let completeOld!: () => void;
    mocks.post.mockImplementationOnce(() => new Promise<void>(resolve => { completeOld = resolve; }));
    mocks.post.mockImplementationOnce(() => new Promise(() => {}));
    stop = startUserAppAccessTracking("user-a");
    mocks.stateListener!("background"); mocks.stateListener!("active");
    completeOld();
    await flush();
    mocks.onlineListener!(true);
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("handles a failed write and permits the next foreground attempt", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.post.mockRejectedValueOnce(new Error("private backend details"));
      stop = startUserAppAccessTracking("user-a");
      await flush();
      expect(vi.getTimerCount()).toBe(0);
      mocks.stateListener!("background"); mocks.stateListener!("active");
      expect(mocks.post).toHaveBeenCalledTimes(2);
      expect(warning).toHaveBeenCalledWith("[UserAppAccess] Recent access could not be recorded");
    } finally { warning.mockRestore(); }
  });
});
