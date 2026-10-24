import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContext } from "@react-navigation/native";

import { HomeScreen } from "./HomeScreen";
import { HOME_DATA_STALE_TIME_MS } from "../bootstrap/appBootstrap";
import type { HomeScreenProps } from "../types";

const apiMocks = vi.hoisted(() => ({
  groupBuys: vi.fn(),
  homeBanners: vi.fn(),
  requestRankings: vi.fn(),
}));

vi.mock("@tanstack/react-query", (importOriginal) => importOriginal());
vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);
  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    Image: passthrough("Image"),
    Pressable: passthrough("Pressable"),
    RefreshControl: passthrough("RefreshControl"),
    ScrollView: passthrough("ScrollView"),
    StatusBar: passthrough("StatusBar"),
    Text: passthrough("Text"),
    TextInput: passthrough("TextInput"),
    View: passthrough("View"),
    Platform: { OS: "ios", select: (values: Record<string, unknown>) => values.ios },
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("@react-navigation/native", async () => {
  const actual = await vi.importActual<typeof import("@react-navigation/core")>(
    "@react-navigation/core",
  );
  return {
    NavigationContext: actual.NavigationContext,
    useFocusEffect: actual.useFocusEffect,
  };
});
vi.mock("../api", () => ({
  fetchGroupBuys: apiMocks.groupBuys,
  fetchHomeBannerGroupBuys: apiMocks.homeBanners,
}));
vi.mock("../features/groupBuyRequests/api", () => ({
  fetchGroupBuyRequestRankings: apiMocks.requestRankings,
  requestGroupBuy: vi.fn(),
  GroupBuyRequestResponseError: class extends Error {},
  GroupBuyRequestSessionUnavailableError: class extends Error {},
}));
vi.mock("@shopify/flash-list", () => ({ FlashList: () => null }));
vi.mock("../components/DealCard", () => ({ DealCard: () => null }));
vi.mock("../components/ads/NativeAdCard", () => ({ NativeAdCard: () => null }));
vi.mock("../components/home/HomeRequestTicker", () => ({
  HomeRequestTicker: () => null,
}));
vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({ colors: {}, isDark: false }),
}));

function createNavigation() {
  let focused = true;
  const listeners = new Map<string, Set<() => void>>();
  return {
    isFocused: () => focused,
    navigate: vi.fn(),
    addListener: (event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return () => {
        eventListeners.delete(listener);
      };
    },
    setFocused: (nextFocused: boolean) => {
      focused = nextFocused;
      listeners.get(nextFocused ? "focus" : "blur")?.forEach((listener) => listener());
    },
  };
}

async function flushRequests(rounds = 8) {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
  }
}

describe("HomeScreen query lifecycle", () => {
  let client: QueryClient;
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let navigation: ReturnType<typeof createNavigation>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T03:00:00.000Z"));
    navigation = createNavigation();
    client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const successfulRequest = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [];
    };
    apiMocks.groupBuys.mockReset().mockImplementation(successfulRequest);
    apiMocks.homeBanners.mockReset().mockImplementation(successfulRequest);
    apiMocks.requestRankings.mockReset().mockImplementation(successfulRequest);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    client.clear();
    vi.useRealTimers();
  });

  function renderHome() {
    act(() => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={client}>
          <NavigationContext.Provider value={navigation as never}>
            <HomeScreen
              navigation={navigation as unknown as HomeScreenProps["navigation"]}
              route={{ key: "home-query-lifecycle", name: "Home" }}
            />
          </NavigationContext.Provider>
        </QueryClientProvider>,
      );
    });
  }

  it.each(["groupBuys", "homeBanners"] as const)(
    "settles without repeated requests when %s fails on the first focus",
    async (failedQuery) => {
      apiMocks[failedQuery].mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("temporarily unavailable");
      });

      renderHome();
      await flushRequests();

      const settledCalls = {
        groupBuys: apiMocks.groupBuys.mock.calls.length,
        homeBanners: apiMocks.homeBanners.mock.calls.length,
        requestRankings: apiMocks.requestRankings.mock.calls.length,
      };
      await flushRequests();

      expect(apiMocks.groupBuys).toHaveBeenCalledTimes(settledCalls.groupBuys);
      expect(apiMocks.homeBanners).toHaveBeenCalledTimes(settledCalls.homeBanners);
      expect(apiMocks.requestRankings).toHaveBeenCalledTimes(settledCalls.requestRankings);
      expect(settledCalls.groupBuys).toBeLessThanOrEqual(2);
      expect(settledCalls.homeBanners).toBeLessThanOrEqual(2);
    },
  );

  it("refreshes stale home queries after an actual blur and refocus", async () => {
    renderHome();
    await flushRequests();
    const settledCalls = {
      groupBuys: apiMocks.groupBuys.mock.calls.length,
      homeBanners: apiMocks.homeBanners.mock.calls.length,
      requestRankings: apiMocks.requestRankings.mock.calls.length,
    };

    act(() => navigation.setFocused(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOME_DATA_STALE_TIME_MS + 1);
    });
    expect(apiMocks.groupBuys).toHaveBeenCalledTimes(settledCalls.groupBuys);
    expect(apiMocks.homeBanners).toHaveBeenCalledTimes(settledCalls.homeBanners);

    act(() => navigation.setFocused(true));
    await flushRequests();

    expect(apiMocks.groupBuys).toHaveBeenCalledTimes(settledCalls.groupBuys + 1);
    expect(apiMocks.homeBanners).toHaveBeenCalledTimes(settledCalls.homeBanners + 1);
    expect(apiMocks.requestRankings).toHaveBeenCalledTimes(settledCalls.requestRankings + 1);
  });
});
