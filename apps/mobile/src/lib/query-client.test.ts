import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@tanstack/react-query");
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    refresh: vi.fn(),
  },
}));

import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { ApiError } from "./api-types";
import {
  configureQueryOnlineManager,
  createMobileQueryRuntimeLifecycle,
  createMobileQueryClient,
  reportQueryError,
  shouldRetryMobileQuery,
  syncQueryFocus,
} from "./query-client";

describe("mobile query policy", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    focusManager.setFocused(undefined);
  });

  it("treats cached data as stale and revalidates on app lifecycle events", () => {
    const client = createMobileQueryClient();

    expect(client.getDefaultOptions().queries).toMatchObject({
      gcTime: 300_000,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: "always",
      staleTime: 0,
    });
    expect(client.getDefaultOptions().queries?.retry).toBe(
      shouldRetryMobileQuery,
    );
  });

  it("retries one transient failure but never retries client or abort errors", () => {
    expect(
      shouldRetryMobileQuery(0, new TypeError("Network request failed")),
    ).toBe(true);
    expect(
      shouldRetryMobileQuery(1, new TypeError("Network request failed")),
    ).toBe(false);
    expect(shouldRetryMobileQuery(0, new ApiError(503, "Unavailable"))).toBe(
      true,
    );
    expect(shouldRetryMobileQuery(0, new ApiError(429, "Slow down"))).toBe(
      true,
    );
    expect(shouldRetryMobileQuery(0, new ApiError(400, "Bad request"))).toBe(
      false,
    );
    expect(
      shouldRetryMobileQuery(
        0,
        Object.assign(new Error("Aborted"), { name: "AbortError" }),
      ),
    ).toBe(false);
  });

  it("bridges native AppState changes to the TanStack focus manager", () => {
    const setFocused = vi.spyOn(focusManager, "setFocused");

    syncQueryFocus("background", "android");
    syncQueryFocus("active", "android");
    syncQueryFocus("background", "web");

    expect(setFocused).toHaveBeenNthCalledWith(1, false);
    expect(setFocused).toHaveBeenNthCalledWith(2, true);
    expect(setFocused).toHaveBeenCalledTimes(2);
  });

  it("waits for a fresh native network state before focusing resumed queries", async () => {
    type ConnectionState = Awaited<ReturnType<typeof NetInfo.refresh>>;
    const completeRefresh = vi.fn();
    const refreshNetwork = vi.fn(
      () =>
        new Promise<ConnectionState>((resolve) => {
          completeRefresh.mockImplementation(() =>
            resolve({ isConnected: true } as ConnectionState),
          );
        }),
    );
    const order: string[] = [];
    const setFocused = vi
      .spyOn(focusManager, "setFocused")
      .mockImplementation((focused) => {
        order.push(`focus:${String(focused)}`);
      });
    vi.spyOn(onlineManager, "setOnline").mockImplementation((online) => {
      order.push(`online:${String(online)}`);
    });
    const lifecycle = createMobileQueryRuntimeLifecycle({
      platform: "android",
      refreshNetwork,
    });

    await lifecycle.sync("background");
    const resume = lifecycle.sync("active");

    expect(refreshNetwork).toHaveBeenCalledTimes(1);
    expect(setFocused).not.toHaveBeenCalledWith(true);

    completeRefresh();
    await resume;

    expect(order.slice(-2)).toEqual(["online:true", "focus:true"]);
  });

  it("does not let a stale foreground refresh override a newer background state", async () => {
    type ConnectionState = Awaited<ReturnType<typeof NetInfo.refresh>>;
    const completeRefresh = vi.fn();
    const refreshNetwork = vi.fn(
      () =>
        new Promise<ConnectionState>((resolve) => {
          completeRefresh.mockImplementation(() =>
            resolve({ isConnected: true } as ConnectionState),
          );
        }),
    );
    const setFocused = vi.spyOn(focusManager, "setFocused");
    const lifecycle = createMobileQueryRuntimeLifecycle({
      platform: "android",
      refreshNetwork,
    });

    const resume = lifecycle.sync("active");
    await lifecycle.sync("background");
    completeRefresh();
    await resume;

    expect(setFocused).not.toHaveBeenCalledWith(true);
    expect(setFocused).toHaveBeenLastCalledWith(false);
  });

  it("restores query focus when refreshing native connectivity rejects", async () => {
    const lifecycle = createMobileQueryRuntimeLifecycle({
      platform: "android",
      refreshNetwork: vi.fn().mockRejectedValue(new Error("refresh failed")),
    });
    const setFocused = vi.spyOn(focusManager, "setFocused");

    await lifecycle.sync("active");

    expect(setFocused).toHaveBeenLastCalledWith(true);
  });

  it("bridges native connectivity changes to the TanStack online manager", () => {
    type ConnectionListener = Parameters<typeof NetInfo.addEventListener>[0];
    type ConnectionState = Parameters<ConnectionListener>[0];

    let connectionListener: ConnectionListener | undefined;
    let onlineListener:
      | Parameters<typeof onlineManager.setEventListener>[0]
      | undefined;
    const unsubscribe = vi.fn();
    const setOnline = vi.fn();
    vi.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      connectionListener = listener;
      return unsubscribe;
    });
    const setEventListener = vi
      .spyOn(onlineManager, "setEventListener")
      .mockImplementation((listener) => {
        onlineListener = listener;
      });

    configureQueryOnlineManager();

    expect(setEventListener).toHaveBeenCalledTimes(1);
    expect(onlineListener?.(setOnline)).toBe(unsubscribe);
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);

    connectionListener?.({ isConnected: false } as ConnectionState);
    connectionListener?.({ isConnected: true } as ConnectionState);
    connectionListener?.({ isConnected: null } as ConnectionState);

    expect(setOnline).toHaveBeenNthCalledWith(1, false);
    expect(setOnline).toHaveBeenNthCalledWith(2, true);
    expect(setOnline).toHaveBeenNthCalledWith(3, false);
  });

  it("logs query failures with a key and safe error metadata", () => {
    const error = new ApiError(503, "Unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    reportQueryError(error, ["home-banner-group-buys", "2026-07-17"]);

    expect(consoleError).toHaveBeenCalledWith("[Query] request failed", {
      message: "Unavailable",
      name: "ApiError",
      queryKey: ["home-banner-group-buys", "2026-07-17"],
      status: 503,
    });
  });
});
