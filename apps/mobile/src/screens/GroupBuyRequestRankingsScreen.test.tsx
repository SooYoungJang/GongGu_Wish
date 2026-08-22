import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupBuyRequestRankingsScreen } from "./GroupBuyRequestRankingsScreen";
import type { GroupBuyRequestRanking } from "../features/groupBuyRequests";

const rankingState = vi.hoisted(() => ({
  status: "success" as "pending" | "error" | "success",
  data: [] as GroupBuyRequestRanking[],
  error: null as Error | null,
  refetch: vi.fn(),
  isFetching: false,
}));

vi.mock("../features/groupBuyRequests", () => ({
  useGroupBuyRequestRankings: () => rankingState,
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    FlatList: ({ data, renderItem, ListHeaderComponent, ...props }: any) =>
      ReactMock.createElement(
        "FlatList",
        props,
        ListHeaderComponent,
        ...(data ?? []).map((item: unknown, index: number) =>
          renderItem({ item, index }),
        ),
      ),
    Pressable: passthrough("Pressable"),
    StatusBar: passthrough("StatusBar"),
    StyleSheet: { create: (styles: unknown) => styles },
    View: passthrough("View"),
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

vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#ff6b5f",
      accentSoft: "#fff0ed",
      bg: "#ffffff",
      border: "#e5e5ea",
      muted: "#707070",
      panelBg: "#f8f8f8",
      surface: "#ffffff",
      text: "#111111",
      textPrimary: "#111111",
      inverse: "#ffffff",
      warning: "#d18400",
      warningSoft: "#fff8e1",
      error: "#c62828",
      errorSoft: "#ffebee",
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
  }),
}));

vi.mock("../components/ui/SText", () => {
  const ReactMock = require("react");
  return {
    SText: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("SText", props, children),
  };
});

vi.mock("../components/CenteredBackHeader", () => {
  const ReactMock = require("react");
  return {
    CenteredBackHeader: ({ onBack, title, ...props }: any) =>
      ReactMock.createElement(
        "CenteredBackHeader",
        { ...props, onBack, title },
        title,
      ),
  };
});

vi.mock("../components/ui/AsyncStateNotice", () => {
  const ReactMock = require("react");
  return {
    AsyncStateNotice: ({ title, message, onRetry, testID, ...props }: any) =>
      ReactMock.createElement(
        "AsyncStateNotice",
        { ...props, message, onRetry, testID, title },
        `${title} ${message ?? ""}`,
      ),
  };
});

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

function createNavigation() {
  return { goBack: vi.fn() };
}

const rankings: GroupBuyRequestRanking[] = [
  {
    rank: 1,
    requestId: "request-1",
    productName: "에어팟 프로",
    requestCount: 12,
  },
  {
    rank: 2,
    requestId: "request-2",
    productName: "무선 청소기",
    requestCount: 7,
  },
];

describe("GroupBuyRequestRankingsScreen", () => {
  afterEach(() => {
    rankingState.status = "success";
    rankingState.data = [];
    rankingState.error = null;
    rankingState.refetch.mockReset();
    rankingState.isFetching = false;
  });

  it("shows every available request ranking with counts in server order", () => {
    rankingState.data = rankings;
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyRequestRankingsScreen
          navigation={navigation as never}
          route={{ key: "request-rankings", name: "GroupBuyRequestRankings" } as never}
        />,
      );
    });

    expect(flattenText(renderer!.toJSON())).toContain("에어팟 프로");
    expect(flattenText(renderer!.toJSON())).toContain("12명이 요청했어요");
    expect(flattenText(renderer!.toJSON())).toContain("무선 청소기");
    expect(
      renderer!.root.findByProps({
        accessibilityLabel: "1위 에어팟 프로, 12명 요청",
      }),
    ).toBeTruthy();
  });

  it("distinguishes a successful empty result from a loading state", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyRequestRankingsScreen
          navigation={navigation as never}
          route={{ key: "request-rankings", name: "GroupBuyRequestRankings" } as never}
        />,
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "request-ranking-empty-state" }),
    ).toBeTruthy();

    rankingState.status = "pending";
    act(() => renderer!.update(
      <GroupBuyRequestRankingsScreen
        navigation={navigation as never}
        route={{ key: "request-rankings", name: "GroupBuyRequestRankings" } as never}
      />,
    ));
    expect(renderer!.root.findByProps({ testID: "request-ranking-loading" })).toBeTruthy();
  });

  it("shows a retryable error state", () => {
    rankingState.status = "error";
    rankingState.error = new Error("network");
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyRequestRankingsScreen
          navigation={navigation as never}
          route={{ key: "request-rankings", name: "GroupBuyRequestRankings" } as never}
        />,
      );
    });

    const errorState = renderer!.root.findByProps({
      testID: "request-ranking-error-state",
    });
    expect(errorState.props.onRetry).toBe(rankingState.refetch);
  });

  it("keeps the back action accessible", () => {
    const navigation = createNavigation();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyRequestRankingsScreen
          navigation={navigation as never}
          route={{ key: "request-rankings", name: "GroupBuyRequestRankings" } as never}
        />,
      );
    });

    const header = renderer!.root.findByType("CenteredBackHeader" as never);
    act(() => header.props.onBack());
    expect(navigation.goBack).toHaveBeenCalledOnce();
  });
});
