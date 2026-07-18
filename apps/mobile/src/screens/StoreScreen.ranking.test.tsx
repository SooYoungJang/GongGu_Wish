import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreScreen } from "./StoreScreen";
import { ThemeProvider } from "../context/ThemeContext";
import { spacing } from "../design/tokens";
import type { GroupBuyRankingItem } from "../features/ranking/types";

const ranking: GroupBuyRankingItem = {
  groupBuyId: "group-1",
  rank: 1,
  previousRank: 2,
  trend: { kind: "up", delta: 1 },
  productName: "여름 한정 공구",
  brandName: null,
  username: "summer.market",
  category: "living",
  thumbnailUrl: null,
  mediaUrls: [],
  startDate: null,
  endDate: null,
  priceKrw: 200000,
  metrics: {
    deepViews: 12000,
    bookmarks: 83,
    notifications: 0,
    searchClicks: 0,
    score: 91,
    scoreDelta: 0,
  },
  scoreVersion: "v2",
};

const refreshRanking = vi.hoisted(() => vi.fn());
const toggleNotificationMock = vi.hoisted(() => vi.fn());
const authGateMock = vi.hoisted(() => ({
  isAuthenticated: true,
  requireAuth: vi.fn(() => true),
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    interpolate(config: {
      inputRange: number[];
      outputRange: number[];
      extrapolate?: string;
    }) {
      return {
        ...config,
        __getValue: () => {
          const [inputStart, inputEnd] = config.inputRange;
          const [outputStart, outputEnd] = config.outputRange;
          const clamped = Math.min(inputEnd, Math.max(inputStart, this.value));
          const progress =
            inputEnd === inputStart
              ? 0
              : (clamped - inputStart) / (inputEnd - inputStart);
          return outputStart + (outputEnd - outputStart) * progress;
        },
      };
    }
  }

  const flatList = ({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
    ...props
  }: any) =>
    ReactMock.createElement(
      "FlatList",
      props,
      ListHeaderComponent,
      ...(data ?? []).map((item: unknown, index: number) =>
        renderItem({ item, index }),
      ),
      ListFooterComponent,
    );

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    Alert: { alert: vi.fn() },
    Animated: {
      FlatList: flatList,
      Value: AnimatedValue,
      View: passthrough("AnimatedView"),
      event: vi.fn((mapping: any[], config: { listener?: CallableFunction }) => {
        const value = mapping[0].nativeEvent.contentOffset.y as AnimatedValue;
        return (event: { nativeEvent: { contentOffset: { y: number } } }) => {
          value.value = event.nativeEvent.contentOffset.y;
          config.listener?.(event);
        };
      }),
      timing: vi.fn((value: AnimatedValue, config: { toValue: number }) => ({
        start: () => {
          value.value = config.toValue;
        },
      })),
    },
    FlatList: flatList,
    Image: passthrough("Image"),
    Modal: ({
      children,
      visible,
      ...props
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? ReactMock.createElement("Modal", props, children) : null),
    Pressable: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("Pressable", props, children),
    ScrollView: passthrough("ScrollView"),
    StyleSheet: { absoluteFillObject: {}, create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useColorScheme: () => "light",
    useWindowDimensions: () => ({
      width: 375,
      height: 812,
      scale: 2,
      fontScale: 1,
    }),
  };
});

vi.mock("react-native-safe-area-context", () => {
  const ReactMock = require("react");
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("SafeAreaView", props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

vi.mock("../features/ranking/usePopularGroupBuys", () => ({
  usePopularGroupBuys: () => ({
    status: "ready",
    data: [ranking],
    refreshing: false,
    updatedAt: Date.now(),
    refresh: refreshRanking,
  }),
}));

vi.mock("../hooks/useLocalDeals", () => ({
  useNotifications: () => ({
    isNotifying: () => false,
    getNotificationState: () => ({ status: "idle" }),
    toggleNotification: toggleNotificationMock,
  }),
}));
vi.mock("../hooks/useAuthGate", () => ({
  useAuthGate: () => authGateMock,
}));

vi.mock("../api", () => ({ syncNotification: vi.fn() }));

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join(" ") ?? ""
  );
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }

  return style && typeof style === "object"
    ? (style as Record<string, unknown>)
    : {};
}

function createNavigation() {
  let tabPressListener: (() => void) | undefined;
  return {
    navigate: vi.fn(),
    addListener: vi.fn((_eventName: string, listener: () => void) => {
      tabPressListener = listener;
      return vi.fn();
    }),
    isFocused: vi.fn(() => true),
    emitTabPress: () => tabPressListener?.(),
  };
}

describe("StoreScreen ranking redesign", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    authGateMock.isAuthenticated = true;
    authGateMock.requireAuth.mockImplementation(() => true);
  });

  it("blocks guest alert changes behind the login screen", () => {
    authGateMock.isAuthenticated = false;
    authGateMock.requireAuth.mockImplementation(() => false);
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const alert = renderer!.root.findByProps({
      accessibilityLabel: "여름 한정 공구 알림",
    });
    act(() => alert.props.onPress());

    expect(authGateMock.requireAuth).toHaveBeenCalledOnce();
    expect(toggleNotificationMock).not.toHaveBeenCalled();
  });

  it("shows the clean ranking header and removes the non-functional global alert action", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    const pressables = renderer!.root.findAllByType(
      "Pressable" as unknown as React.ElementType,
    );
    expect(text).not.toContain("사람들이 많이 찾고 저장한 공구를 모았어요");
    expect(text).toContain("업데이트");
    expect(text).not.toContain("전체 랭킹");
    expect(text).toContain("인기 공구");
    expect(text).toContain("인기지수 안내");
    expect(text).toContain("현재 목록 최고점=100");
    expect(text).toContain("조회·저장·알림·상세 관심");
    expect(
      renderer!.root.findByProps({ testID: "ranking-basis-bar" }),
    ).toBeTruthy();
    expect(
      pressables.filter(
        (item) => item.props.accessibilityLabel === "랭킹 검색",
      ),
    ).toHaveLength(1);
    expect(
      pressables.filter(
        (item) => item.props.accessibilityLabel === "랭킹 알림",
      ),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByProps({ name: "search-outline" }),
    ).toHaveLength(1);
  });

  it("keeps period, sort, category, and ranking basis in one sticky header", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    act(() => {
      renderer!.root
        .findByProps({ testID: "ranking-filter-header" })
        .props.onLayout({
          nativeEvent: { layout: { height: 184, width: 375, x: 0, y: 0 } },
        });
    });

    const header = renderer!.root.findByProps({
      testID: "ranking-filter-header",
    });
    const clip = renderer!.root.findByProps({ testID: "ranking-scroll-clip" });
    expect(flattenStyle(clip.props.style).overflow).toBe("hidden");
    expect(
      header.findAllByProps({ testID: "ranking-basis-bar" }).length,
    ).toBeGreaterThan(0);
    expect(
      header.findAllByProps({ accessibilityLabel: "인기 공구 정렬" }).length,
    ).toBeGreaterThan(0);
    expect(
      header.findAllByProps({ accessibilityLabel: "카테고리 전체 선택" })
        .length,
    ).toBeGreaterThan(0);

    expect(
      flattenStyle(
        renderer!.root.findByProps({ testID: "ranking-filter-header" }).props
          .style,
      ).position,
    ).toBe("absolute");
  });

  it("collapses auxiliary filters on scroll while keeping the period tabs pinned", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    act(() => {
      renderer!.root
        .findByProps({ testID: "ranking-collapsible-filters" })
        .props.onLayout({
          nativeEvent: { layout: { height: 132, width: 375, x: 0, y: 0 } },
        });
    });

    const flatList = renderer!.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    act(() =>
      flatList.props.onScroll({
        nativeEvent: { contentOffset: { y: 240 } },
      }),
    );

    const header = renderer!.root.findByProps({
      testID: "ranking-filter-header",
    });
    const transform = flattenStyle(header.props.style).transform as Array<{
      translateY: { __getValue: () => number };
    }>;

    expect(transform[0].translateY.__getValue()).toBe(-132);
    expect(
      header.findByProps({ testID: "ranking-period-tabs" }),
    ).toBeTruthy();
    expect(
      header.findAllByProps({ testID: "ranking-basis-bar" }),
    ).toHaveLength(0);
    expect(
      header.findAllByProps({ accessibilityLabel: "카테고리 전체 선택" }),
    ).toHaveLength(0);
    expect(
      header.findByProps({ testID: "ranking-collapsible-filters" }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      header.findByProps({ testID: "ranking-collapsible-filters" }).props
        .importantForAccessibility,
    ).toBe("no-hide-descendants");

    act(() =>
      flatList.props.onScroll({
        nativeEvent: { contentOffset: { y: 0 } },
      }),
    );
    expect(
      renderer!.root.findByProps({ testID: "ranking-collapsible-filters" })
        .props.accessibilityElementsHidden,
    ).toBe(false);
    expect(
      renderer!.root.findByProps({ testID: "ranking-basis-bar" }),
    ).toBeTruthy();
  });

  it("uses scalable period tabs instead of a fixed text height", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const weeklyTab = renderer!.root.findByProps({
      accessibilityLabel: "이번 주 랭킹 기간",
    });
    const style = flattenStyle(weeklyTab.props.style);

    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("keeps the search target at least 44 by 44 points", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const search = renderer!.root.findByProps({ accessibilityLabel: "랭킹 검색" });
    const style = flattenStyle(search.props.style({ pressed: false }));
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it("keeps the list inset stable under the unified sticky header", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    act(() => {
      renderer!.root
        .findByProps({ testID: "ranking-filter-header" })
        .props.onLayout({
          nativeEvent: { layout: { height: 184, width: 375, x: 0, y: 0 } },
        });
    });

    const initialList = renderer!.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    const initialTopInset = flattenStyle(
      initialList.props.contentContainerStyle,
    ).paddingTop;
    expect(initialTopInset).toBe(184 + spacing.sm);

    expect(initialList.props.contentContainerStyle).toBeTruthy();
    expect(initialList.props.progressViewOffset).toBe(
      184 + spacing.sm + spacing.lg,
    );
  });

  it("refreshes the ranking when its active GNB tab is pressed again", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const flatList = renderer!.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    expect(flatList.props.onRefresh).toBe(refreshRanking);

    act(() => navigation.emitTabPress());

    expect(refreshRanking).toHaveBeenCalledTimes(1);
  });

  it("opens the ranked group-buy detail using the canonical groupBuyId", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const rowAction = renderer!.root
      .findAllByType("Pressable" as unknown as React.ElementType)
      .find(
        (pressable) => pressable.props.accessibilityHint === "공구 상세 보기",
      );

    act(() => rowAction!.props.onPress());

    expect(navigation.navigate).toHaveBeenCalledWith("Detail", {
      groupBuy: expect.objectContaining({ id: "group-1", priceKrw: 200000 }),
    });
  });

  it("opens the seller's group-buy list from a separate accessible target", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <StoreScreen
            navigation={navigation as never}
            route={{ key: "Store-test", name: "Store" } as never}
          />
        </ThemeProvider>,
      );
    });

    const sellerAction = renderer!.root.findByProps({
      accessibilityLabel: "@summer.market 판매자 공구 보기",
    });
    act(() => sellerAction.props.onPress());

    expect(navigation.navigate).toHaveBeenCalledWith("InfluencerGroupBuys", {
      influencerUsername: "summer.market",
      influencerDisplayName: null,
    });
  });
});
