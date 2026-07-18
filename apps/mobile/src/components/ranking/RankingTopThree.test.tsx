import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RankingTopThree } from "./RankingTopThree";
import { ThemeProvider } from "../../context/ThemeContext";
import type { GroupBuyRankingItem } from "../../features/ranking/types";

const windowDimensionsMock = vi.hoisted(() => ({
  fontScale: 1,
  height: 812,
  width: 375,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name }),
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Image: passthrough("Image"),
    Pressable: passthrough("Pressable"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useColorScheme: () => "light",
    useWindowDimensions: () => ({
      ...windowDimensionsMock,
      scale: 2,
    }),
  };
});

function sampleRanking(
  rank: number,
  overrides: Partial<GroupBuyRankingItem> = {},
): GroupBuyRankingItem {
  return {
    groupBuyId: `group-${rank}`,
    rank,
    previousRank: rank,
    trend: { kind: "same" },
    productName: `공구 상품 ${rank}`,
    brandName: null,
    username: `seller-${rank}`,
    category: "living",
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: null,
    metrics: {
      deepViews: 1000 * rank,
      bookmarks: rank,
      notifications: rank,
      searchClicks: 0,
      score: 100 - rank,
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

describe("RankingTopThree", () => {
  beforeEach(() => {
    windowDimensionsMock.fontScale = 1;
    windowDimensionsMock.width = 375;
  });

  it("stacks compact cards and releases text clamps for large fonts", () => {
    windowDimensionsMock.fontScale = 2;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(1), sampleRanking(2), sampleRanking(3)]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const grid = renderer!.root.findByProps({
      testID: "ranking-top-compact-grid",
    });
    const heroName = renderer!.root.findByProps({
      testID: "ranking-top-name-1",
    });

    expect(grid.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flexDirection: "column" }),
      ]),
    );
    expect(heroName.props.numberOfLines).toBeUndefined();
  });

  it("stacks spotlight cards on a 320 point wide screen", () => {
    windowDimensionsMock.width = 320;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(1), sampleRanking(2), sampleRanking(3)]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const grid = renderer!.root.findByProps({
      testID: "ranking-top-compact-grid",
    });

    expect(grid.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flexDirection: "column" }),
      ]),
    );
  });

  it("renders rank one as a hero and ranks two and three as compact cards", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(1), sampleRanking(2), sampleRanking(3)]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "ranking-top-three" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-hero" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-compact-2" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-compact-3" }),
    ).toBeTruthy();
  });

  it("leads with product imagery and rank movement without popularity scores", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[
              sampleRanking(1, {
                thumbnailUrl: "https://example.com/leader.jpg",
                endDate: "2099-07-31T15:00:00.000Z",
                trend: { kind: "up", delta: 16 },
                metrics: {
                  deepViews: 5000,
                  bookmarks: 0,
                  notifications: 0,
                  searchClicks: 0,
                  score: 100,
                  scoreDelta: 0,
                },
              }),
              sampleRanking(2, {
                trend: { kind: "new" },
                metrics: {
                  deepViews: 3000,
                  bookmarks: 20,
                  notifications: 4,
                  searchClicks: 2,
                  score: 50,
                  scoreDelta: 0,
                },
              }),
              sampleRanking(3, {
                trend: { kind: "down", delta: 2 },
                metrics: {
                  deepViews: 2000,
                  bookmarks: 0,
                  notifications: 12,
                  searchClicks: 1,
                  score: 25,
                  scoreDelta: 0,
                },
              }),
            ]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");

    expect(
      renderer!.root.findByProps({ testID: "ranking-top-image-1" }),
    ).toBeTruthy();
    expect(text).toContain("지금 가장 인기 있는 공구");
    expect(text).toContain("▲16위");
    expect(text).toContain("NEW");
    expect(text).toContain("▼2위");
    expect(text).not.toContain("인기지수");
    expect(text).toContain("마감");
    expect(text).toContain("상품 이미지 준비 중");
  });

  it("falls back gracefully when the hero image fails to load", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[
              sampleRanking(1, {
                thumbnailUrl: "https://example.com/broken.jpg",
              }),
            ]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const image = renderer!.root.findByProps({
      testID: "ranking-top-image-1",
    });
    act(() => image.props.onError());

    expect(
      renderer!.root.findAllByProps({ testID: "ranking-top-image-1" }),
    ).toHaveLength(0);
    expect(flattenText(renderer!.toJSON())).toContain("상품 이미지 준비 중");
  });

  it("never promotes ranks two or three into the hero slot", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(2), sampleRanking(3)]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    expect(
      renderer!.root
        .findAllByType("View" as unknown as React.ElementType)
        .filter((node) => node.props.testID === "ranking-top-hero"),
    ).toHaveLength(0);
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-compact-2" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "ranking-top-compact-3" }),
    ).toBeTruthy();
  });

  it("preserves the server order of spotlight ranks", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(3), sampleRanking(2)]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const compactCards = renderer!.root
      .findAllByType("View" as unknown as React.ElementType)
      .filter(
        (node) =>
          node.props.testID === "ranking-top-compact-2" ||
          node.props.testID === "ranking-top-compact-3",
      );
    expect(compactCards.map((node) => node.props.testID)).toEqual([
      "ranking-top-compact-3",
      "ranking-top-compact-2",
    ]);
  });

  it("does not truncate a long seller name at large font scales", () => {
    windowDimensionsMock.fontScale = 2;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[
              sampleRanking(1, {
                username: "very.long.seller.name.for.accessibility",
              }),
            ]}
            onPress={vi.fn()}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "ranking-top-seller-1" }).props
        .numberOfLines,
    ).toBeUndefined();
  });

  it("keeps each top card detail action separate from its alert action", () => {
    const onPress = vi.fn();
    const onToggleAlert = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(1, { productName: "분리된 공구" })]}
            onPress={onPress}
            onToggleAlert={onToggleAlert}
          />
        </ThemeProvider>,
      );
    });

    const detailAction = renderer!.root.findByProps({
      accessibilityHint: "공구 상세 보기",
    });
    const alertAction = renderer!.root.findByProps({
      accessibilityLabel: "분리된 공구 알림",
    });

    act(() => detailAction.props.onPress());
    act(() => alertAction.props.onPress());

    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ rank: 1 }));
    expect(onToggleAlert).toHaveBeenCalledWith(
      expect.objectContaining({ groupBuyId: "group-1" }),
    );
    expect(detailAction.props.accessibilityLabel).not.toContain("인기지수");
    expect(detailAction.props.accessibilityLabel).toContain("가격 정보 없음");
    expect(detailAction.props.accessibilityLabel).toContain("마감일 미정");
  });

  it("keeps the seller destination separate from the product detail action", () => {
    const onPressSeller = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingTopThree
            items={[sampleRanking(1)]}
            onPress={vi.fn()}
            onPressSeller={onPressSeller}
            onToggleAlert={vi.fn()}
          />
        </ThemeProvider>,
      );
    });

    const sellerAction = renderer!.root.findByProps({
      accessibilityLabel: "@seller-1 판매자 공구 보기",
    });
    act(() => sellerAction.props.onPress());

    expect(onPressSeller).toHaveBeenCalledWith(
      expect.objectContaining({ username: "seller-1" }),
    );
  });
});
