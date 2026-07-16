import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { GroupBuyAlertButton } from "./FollowButton";
import { RankBadge } from "./RankBadge";
import { RankingTrendBadge } from "./RankingTrendBadge";
import { SellerRankingList } from "./SellerRankingList";
import { SellerRankingRow } from "./SellerRankingRow";
import { ThemeProvider } from "../../context/ThemeContext";
import { commerceLightColors, commerceRadius } from "../../design/commerce";
import { spacing } from "../../design/tokens";
import type { GroupBuyRankingItem } from "../../features/ranking/types";
import { getRankingTrend } from "../../features/ranking/types";

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  const flatList = ({
    data,
    renderItem,
    ItemSeparatorComponent,
    ListFooterComponent,
    ...props
  }: any) =>
    ReactMock.createElement(
      "FlatList",
      props,
      ...(data ?? []).flatMap((item: unknown, index: number) => [
        renderItem({ item, index }),
        ItemSeparatorComponent
          ? ReactMock.createElement(ItemSeparatorComponent, {
              key: `separator-${index}`,
            })
          : null,
      ]),
      ListFooterComponent,
    );

  return {
    Animated: { FlatList: flatList },
    FlatList: flatList,
    Pressable: ({ children, ...props }: any) =>
      ReactMock.createElement("Pressable", props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({
      width: 375,
      height: 812,
      scale: 2,
      fontScale: 1,
    }),
    useColorScheme: () => "light",
    Text: passthrough("Text"),
    View: passthrough("View"),
  };
});

function withTheme(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function sampleRanking(
  overrides: Partial<GroupBuyRankingItem> = {},
): GroupBuyRankingItem {
  return {
    groupBuyId: "group-sample",
    rank: 1,
    previousRank: 2,
    trend: getRankingTrend(1, 2),
    productName: "샘플마켓",
    brandName: null,
    username: "sample.market",
    category: "food",
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: null,
    metrics: {
      deepViews: 12300,
      bookmarks: 7,
      notifications: 2,
      searchClicks: 0,
      score: 96,
      scoreDelta: 0,
    },
    scoreVersion: "v2",
    ...overrides,
  };
}

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

describe("ranking components", () => {
  it("renders top-three ranks without leading zeroes", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(withTheme(<RankBadge rank={1} />));
    });

    expect(flattenText(renderer!.toJSON())).toBe("1");
  });

  it("renders every top-three rank badge as a fixed circle", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <>
            <RankBadge rank={1} />
            <RankBadge rank={2} />
            <RankBadge rank={3} />
          </>,
        ),
      );
    });

    for (const rank of [1, 2, 3]) {
      const badge = renderer!.root.findByProps({
        accessibilityLabel: `${rank}위`,
      });
      const style = flattenStyle(badge.props.style);

      expect(style.width).toBe(34);
      expect(style.height).toBe(34);
      expect(style.borderRadius).toBe(17);
      expect(style.borderCurve).toBe("circular");
    }
  });

  it("keeps filtered ranking positions circular beyond the top three", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(withTheme(<RankBadge rank={5} />));
    });

    const badge = renderer!.root.findByProps({ accessibilityLabel: "5위" });
    const style = flattenStyle(badge.props.style);

    expect(style.width).toBe(34);
    expect(style.height).toBe(34);
    expect(style.borderRadius).toBe(17);
    expect(style.borderCurve).toBe("circular");
  });

  it("clips colored backgrounds so recycled rank badges stay circular", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <>
            <RankBadge rank={1} />
            <RankBadge rank={2} />
            <RankBadge rank={3} />
          </>,
        ),
      );
    });

    for (const rank of [1, 2, 3]) {
      const badge = renderer!.root.findByProps({
        accessibilityLabel: `${rank}위`,
      });
      const style = flattenStyle(badge.props.style);

      expect(style.overflow).toBe("hidden");
    }
  });

  it("renders ranking trends as color-only directional text", () => {
    const cases: Array<{
      trend: GroupBuyRankingItem["trend"];
      label: string;
      color: string;
    }> = [
      {
        trend: { kind: "up", delta: 2 },
        label: "▲2",
        color: commerceLightColors.accent,
      },
      {
        trend: { kind: "down", delta: 3 },
        label: "▼3",
        color: commerceLightColors.blue,
      },
      { trend: { kind: "same" }, label: "-", color: commerceLightColors.weak },
    ];

    for (const testCase of cases) {
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          withTheme(<RankingTrendBadge trend={testCase.trend} />),
        );
      });

      const textNode = renderer!.root.findByType(
        "Text" as unknown as React.ElementType,
      );
      const style = flattenStyle(textNode.props.style);

      expect(flattenText(renderer!.toJSON())).toBe(testCase.label);
      expect(style.color).toBe(testCase.color);
      expect(
        renderer!.root.findAllByType("View" as unknown as React.ElementType),
      ).toHaveLength(0);
    }
  });

  it("toggles GroupBuyAlertButton visual state through its onPress prop", () => {
    let following = false;
    const onFollow = vi.fn(() => {
      following = !following;
    });
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <GroupBuyAlertButton
            isEnabled={following}
            groupBuyName="샘플마켓"
            onPress={onFollow}
          />,
        ),
      );
    });

    expect(
      renderer!.root.findByProps({ accessibilityLabel: "샘플마켓 알림" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ name: "notifications-outline" }),
    ).toBeTruthy();

    const pressable = renderer!.root.findByType(
      "Pressable" as unknown as React.ElementType,
    );
    act(() => pressable.props.onPress());
    act(() => {
      renderer!.update(
        withTheme(
          <GroupBuyAlertButton
            isEnabled={following}
            groupBuyName="샘플마켓"
            onPress={onFollow}
          />,
        ),
      );
    });

    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "샘플마켓 알림 해제" }),
    ).toBeTruthy();
    expect(renderer!.root.findByProps({ name: "notifications" })).toBeTruthy();
  });

  it("communicates pending and failed alert states accessibly", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const onRetry = vi.fn();

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <GroupBuyAlertButton
            groupBuyName="샘플마켓"
            isEnabled
            notificationState={{ status: "pending", action: "enable" }}
            onPress={vi.fn()}
          />,
        ),
      );
    });

    const pending = renderer!.root.findByType(
      "Pressable" as unknown as React.ElementType,
    );
    expect(pending.props.accessibilityLabel).toBe("샘플마켓 알림 처리 중");
    expect(pending.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });

    act(() => {
      renderer!.update(
        withTheme(
          <GroupBuyAlertButton
            groupBuyName="샘플마켓"
            isEnabled
            notificationState={{
              status: "failed",
              action: "enable",
              reason: "schedule-failed",
              retryable: true,
            }}
            onRetry={onRetry}
          />,
        ),
      );
    });

    const failed = renderer!.root.findByType(
      "Pressable" as unknown as React.ElementType,
    );
    expect(failed.props.accessibilityLabel).toBe("샘플마켓 알림 재시도");
    act(() => failed.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("wires seller row follow button to the selected ranking item", () => {
    const item = sampleRanking({
      groupBuyId: "group-follow-target",
      productName: "팔로우대상",
    });
    const onToggleFollow = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={item}
            onPress={vi.fn()}
            onToggleAlert={onToggleFollow}
          />,
        ),
      );
    });

    const followButton = renderer!.root
      .findAllByType("Pressable" as unknown as React.ElementType)
      .find(
        (pressable) => pressable.props.accessibilityLabel === "팔로우대상 알림",
      );

    act(() => followButton!.props.onPress());

    expect(onToggleFollow).toHaveBeenCalledTimes(1);
    expect(onToggleFollow).toHaveBeenCalledWith(item);
  });

  it("shows the actual popularity metrics instead of a misleading deal count", () => {
    const item = sampleRanking({
      priceKrw: 25900,
      metrics: {
        deepViews: 12300,
        bookmarks: 7,
        notifications: 2,
        searchClicks: 0,
        score: 96,
        scoreDelta: 0,
      },
    });
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={item}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />,
        ),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(text).toContain("조회 1.2만");
    expect(text).toContain("저장 7");
    expect(text).toContain("인기지수 96");
    expect(text).toContain("25,900원");
    expect(text).not.toContain("공구 7개");
  });

  it("uses the same rounded card surface for every ranking row", () => {
    const rankings = [1, 2, 3, 4].map((rank) =>
      sampleRanking({ groupBuyId: `group-${rank}`, rank }),
    );
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList state={{ status: "ready", data: rankings }} />,
        ),
      );
    });

    for (const rank of [1, 2, 3, 4]) {
      const row = renderer!.root.findByProps({ testID: `ranking-row-${rank}` });
      const style = flattenStyle(row.props.style);

      expect(style.borderRadius).toBe(commerceRadius.lg);
      expect(style.borderCurve).toBe("continuous");
      expect(style.backgroundColor).toBe(commerceLightColors.panelBg);
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe(commerceLightColors.borderLight);
      expect(style.borderBottomWidth).toBeUndefined();
      expect(style.overflow).toBeUndefined();
      expect(style.shadowOpacity).toBeLessThanOrEqual(0.08);
      expect(style.elevation).toBeLessThanOrEqual(1);
      expect(style.marginBottom).toBe(spacing.sm);
    }
  });

  it("keeps every row rounded when a filter replaces the list data", () => {
    const initialRankings = [1, 2, 3, 4].map((rank) =>
      sampleRanking({ groupBuyId: `initial-group-${rank}`, rank }),
    );
    const filteredRankings = [7, 8, 9, 10].map((rank) =>
      sampleRanking({ groupBuyId: `filtered-group-${rank}`, rank }),
    );
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{ status: "ready", data: initialRankings }}
          />,
        ),
      );
    });

    act(() => {
      renderer!.update(
        withTheme(
          <SellerRankingList
            state={{ status: "ready", data: filteredRankings }}
          />,
        ),
      );
    });

    for (const rank of [7, 8, 9, 10]) {
      const row = renderer!.root.findByProps({ testID: `ranking-row-${rank}` });
      const style = flattenStyle(row.props.style);

      expect(style.borderRadius).toBe(commerceRadius.lg);
      expect(style.borderCurve).toBe("continuous");
      expect(style.backgroundColor).toBe(commerceLightColors.panelBg);
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe(commerceLightColors.borderLight);
      expect(style.overflow).toBeUndefined();
      expect(style.borderBottomWidth).toBeUndefined();
    }
  });

  it("renders ready ranking rows with list accessibility and compact Korean counts", () => {
    const rankings = [
      sampleRanking({
        metrics: {
          deepViews: 12300,
          bookmarks: 7,
          notifications: 2,
          searchClicks: 0,
          score: 96,
          scoreDelta: 0,
        },
      }),
    ];
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{ status: "ready", data: rankings }}
            bottomPadding={88}
          />,
        ),
      );
    });

    const flatList = renderer!.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");

    expect(flatList.props.accessibilityLabel).toBe("공구 랭킹 목록");
    expect(flatList.props.showsVerticalScrollIndicator).toBe(false);
    expect(text).toContain("샘플마켓");
    expect(text).toContain("조회");
    expect(text).toContain("저장");
    expect(text).toContain("7");
  });

  it("forwards the shared animated scroll handler to the native list", () => {
    const onScroll = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{ status: "ready", data: [sampleRanking()] }}
            onScroll={onScroll}
          />,
        ),
      );
    });

    const flatList = renderer!.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    const event = { nativeEvent: { contentOffset: { y: 24 } } };
    act(() => flatList.props.onScroll(event));

    expect(onScroll).toHaveBeenCalledWith(event);
  });

  it("renders ranking empty state action when rankings are empty", () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{
              status: "empty",
              message: "아직 집계된 랭킹이 없어요",
              action: { label: "전체 보기", onPress },
            }}
            bottomPadding={0}
          />,
        ),
      );
    });

    const action = renderer!.root.findByProps({
      accessibilityLabel: "전체 보기",
    });
    act(() => action.props.onPress());

    expect(flattenText(renderer!.toJSON())).toContain(
      "아직 집계된 랭킹이 없어요",
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
