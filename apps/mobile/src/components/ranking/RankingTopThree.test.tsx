import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { RankingTopThree } from "./RankingTopThree";
import { ThemeProvider } from "../../context/ThemeContext";
import type { GroupBuyRankingItem } from "../../features/ranking/types";

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
      width: 375,
      height: 812,
      scale: 2,
      fontScale: 1,
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

describe("RankingTopThree", () => {
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
      accessibilityLabel: "1위 분리된 공구 상세 보기",
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
