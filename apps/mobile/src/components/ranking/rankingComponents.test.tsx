import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const windowDimensionsMock = vi.hoisted(() => ({
  fontScale: 1,
  height: 812,
  width: 375,
}));

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
    ListHeaderComponent,
    ListFooterComponent,
    ...props
  }: any) =>
    ReactMock.createElement(
      "FlatList",
      props,
      ListHeaderComponent,
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
    ActivityIndicator: passthrough("ActivityIndicator"),
    Animated: { FlatList: flatList },
    FlatList: flatList,
    Image: passthrough("Image"),
    Pressable: ({ children, ...props }: any) =>
      ReactMock.createElement("Pressable", props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({
      ...windowDimensionsMock,
      scale: 2,
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
  beforeEach(() => {
    windowDimensionsMock.fontScale = 1;
    windowDimensionsMock.width = 375;
  });

  it("stacks ordinary ranking rows and releases text clamps for large fonts", () => {
    windowDimensionsMock.fontScale = 2;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={sampleRanking()}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />,
        ),
      );
    });

    const mainRow = renderer!.root.findByProps({
      testID: "ranking-row-main-1",
    });
    const name = renderer!.root.findByProps({
      testID: "ranking-row-name-1",
    });
    const signal = renderer!.root.findByProps({
      testID: "ranking-row-signal-1",
    });

    expect(flattenStyle(mainRow.props.style).flexDirection).toBe("column");
    expect(name.props.numberOfLines).toBeUndefined();
    expect(signal.props.numberOfLines).toBeUndefined();
  });

  it("falls back gracefully when a ranking row image fails to load", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={sampleRanking({
              thumbnailUrl: "https://example.com/broken.jpg",
            })}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />,
        ),
      );
    });

    const image = renderer!.root.findByProps({
      testID: "ranking-row-image-1",
    });
    act(() => image.props.onError());

    expect(
      renderer!.root.findAllByProps({ testID: "ranking-row-image-1" }),
    ).toHaveLength(0);
    expect(flattenText(renderer!.toJSON())).toContain("샘");
  });

  it("does not truncate a long row seller name at large font scales", () => {
    windowDimensionsMock.fontScale = 2;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={sampleRanking({
              rank: 4,
              username: "very.long.seller.name.for.accessibility",
            })}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />,
        ),
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "ranking-row-seller-4" }).props
        .numberOfLines,
    ).toBeUndefined();
  });

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

  it("renders ranking trends with directional symbols in addition to color", () => {
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

  it("keeps the alert action at least 44 by 44 points", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <GroupBuyAlertButton
            groupBuyName="샘플마켓"
            isEnabled={false}
            onPress={vi.fn()}
          />,
        ),
      );
    });

    const action = renderer!.root.findByType(
      "Pressable" as unknown as React.ElementType,
    );
    const style = flattenStyle(action.props.style({ pressed: false }));
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
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

  it("keeps an ordinary row seller action separate from the detail action", () => {
    const item = sampleRanking({
      groupBuyId: "group-seller-target",
      rank: 4,
      username: "ordinary.seller",
    });
    const onPressSeller = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingRow
            item={item}
            onPress={vi.fn()}
            onPressSeller={onPressSeller}
            onToggleAlert={vi.fn()}
          />,
        ),
      );
    });

    const sellerAction = renderer!.root.findByProps({
      accessibilityLabel: "@ordinary.seller 판매자 공구 보기",
    });
    act(() => sellerAction.props.onPress());

    expect(onPressSeller).toHaveBeenCalledWith(item);
  });

  it("shows a relative popularity reason and deadline instead of technical metrics", () => {
    const item = sampleRanking({
      endDate: "2099-07-31T15:00:00.000Z",
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
            topScore={192}
          />,
        ),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(text).toContain("인기지수 50");
    expect(text).toContain("저장 반응 있음");
    expect(text).toContain("마감");
    expect(text).toContain("25,900원");
    expect(text).not.toContain("조회 1.2만 · 저장 7 · 알림 2");
    expect(text).not.toContain("공구 7개");

    const detailAction = renderer!.root.findByProps({
      accessibilityHint: "공구 상세 보기",
    });
    expect(detailAction.props.accessibilityLabel).toContain("25,900원");
    expect(detailAction.props.accessibilityLabel).toContain("인기지수 50");
    expect(detailAction.props.accessibilityLabel).not.toContain("조회 1.2만");
  });

  it("ignores a malformed score without zeroing every item index", () => {
    const rankings = [
      sampleRanking({
        groupBuyId: "score-100",
        rank: 1,
        metrics: { ...sampleRanking().metrics, score: 100 },
      }),
      sampleRanking({
        groupBuyId: "score-invalid",
        rank: 2,
        metrics: { ...sampleRanking().metrics, score: Number.NaN },
      }),
      sampleRanking({
        groupBuyId: "score-50",
        rank: 3,
        metrics: { ...sampleRanking().metrics, score: 50 },
      }),
    ];
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingList state={{ status: "ready", data: rankings }} />),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(text).toContain("인기지수 100");
    expect(text).toContain("인기지수 0");
    expect(text).toContain("인기지수 50");
  });

  it("does not promote a misplaced top rank ahead of the server order", () => {
    const rankings = [
      sampleRanking({ groupBuyId: "rank-4", rank: 4 }),
      sampleRanking({ groupBuyId: "rank-1", rank: 1 }),
      sampleRanking({ groupBuyId: "rank-2", rank: 2 }),
    ];
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingList state={{ status: "ready", data: rankings }} />),
      );
    });

    expect(
      renderer!.root
        .findAllByType("View" as unknown as React.ElementType)
        .filter((node) => node.props.testID === "ranking-top-hero"),
    ).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "ranking-row-4" })).toBeTruthy();
    expect(renderer!.root.findByProps({ testID: "ranking-row-1" })).toBeTruthy();
    expect(renderer!.root.findByProps({ testID: "ranking-row-2" })).toBeTruthy();
  });

  it("uses the same rounded card surface for every ranking row", () => {
    const rankings = [4, 5, 6, 7].map((rank) =>
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

    for (const rank of [4, 5, 6, 7]) {
      const row = renderer!.root.findByProps({ testID: `ranking-row-${rank}` });
      const style = flattenStyle(row.props.style);

      expect(style.borderRadius).toBe(commerceRadius.lg);
      expect(style.borderCurve).toBe("continuous");
      expect(style.backgroundColor).toBe(commerceLightColors.panelBg);
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe(commerceLightColors.borderLight);
      expect(style.borderBottomWidth).toBeUndefined();
      expect(style.overflow).toBeUndefined();
      expect(style.boxShadow).toBeUndefined();
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
            topInset={320}
          />,
        ),
      );
    });

    const action = renderer!.root.findByProps({
      accessibilityLabel: "전체 보기",
    });
    const viewport = renderer!.root.findByProps({
      testID: "ranking-status-viewport",
    });
    act(() => action.props.onPress());

    expect(flattenStyle(viewport.props.style).paddingTop).toBe(320);
    expect(flattenText(renderer!.toJSON())).toContain(
      "아직 집계된 랭킹이 없어요",
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("announces the ranking loading state as progress", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(<SellerRankingList state={{ status: "loading" }} />),
      );
    });

    const viewport = renderer!.root.findByProps({
      testID: "ranking-status-viewport",
    });
    expect(viewport.props.accessibilityRole).toBe("progressbar");
    expect(viewport.props.accessibilityLabel).toBe("랭킹 불러오는 중");
  });

  it("keeps cached ranking rows visible with a stale-data retry notice", () => {
    const refresh = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <SellerRankingList
            state={{
              status: "ready",
              data: [sampleRanking()],
              refresh,
              refreshError: "최신 랭킹을 확인하지 못했어요.",
            }}
          />,
        ),
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "async-state-notice" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-hero" }),
    ).toBeTruthy();

    act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: "다시 불러오기" })
        .props.onPress();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
