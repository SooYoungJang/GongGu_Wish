import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListRenderItem } from "react-native";

import type { GroupBuy } from "../types";
import { ThemeProvider } from "../context/ThemeContext";
import { InfluencerGroupBuysScreen } from "./InfluencerGroupBuysScreen";

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    FlatList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ...props
    }: {
      data: GroupBuy[];
      renderItem: ListRenderItem<GroupBuy>;
      ListEmptyComponent?: React.ReactNode;
    }) => {
      const children = data.length
        ? data.map((item, index) =>
            ReactMock.createElement(
              ReactMock.Fragment,
              { key: item.id },
              renderItem({
                item,
                index,
                separators: {
                  highlight: vi.fn(),
                  unhighlight: vi.fn(),
                  updateProps: vi.fn(),
                },
              }),
            ),
          )
        : ListEmptyComponent;

      return ReactMock.createElement("FlatList", { ...props, data }, children);
    },
    Image: passthrough("Image"),
    Platform: {
      OS: "ios",
      select: (options: Record<string, unknown>) =>
        options.ios ?? options.default,
    },
    Pressable: passthrough("Pressable"),
    RefreshControl: passthrough("RefreshControl"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useColorScheme: () => "light",
  };
});

vi.mock("react-native-safe-area-context", () => {
  const ReactMock = require("react");
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("SafeAreaView", props, children),
  };
});

vi.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("ExpoImage", props);
  },
}));

vi.mock("../components/GroupBuyReminderButton", () => ({
  GroupBuyReminderButton: (props: unknown) => {
    const ReactMock = require("react");
    return ReactMock.createElement("GroupBuyReminderButton", props);
  },
}));

vi.mock("../components/ui/InstagramProfileAvatar", () => ({
  InstagramProfileAvatar: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("InstagramProfileAvatar", {
      ...props,
      accessibilityRole: "image",
    });
  },
}));

const firstGroupBuy: GroupBuy = {
  id: "influencer-deal-1",
  productName: "국내산 오리고기",
  brandName: "무무푸드",
  category: "food",
  startDate: "2099-08-06T00:00:00+09:00",
  endDate: "2099-08-21T23:59:59+09:00",
  purchaseUrl: "https://example.com/products/duck",
  discountInfo: "최대 64,000원 할인",
  priceKrw: 35900,
  summary: "오리육포 공동구매",
  confidence: 0.5,
  thumbnailUrl: "https://example.com/images/duck.jpg",
  videoUrl: null,
  mediaUrls: [],
  mediaType: "IMAGE",
  rawPost: {
    postUrl: "https://www.instagram.com/p/duck",
    influencer: {
      instagramUsername: "bada_ummaya",
      profileImageUrl: "https://example.com/images/bada.jpg",
    },
  },
};

const secondGroupBuy: GroupBuy = {
  ...firstGroupBuy,
  id: "influencer-deal-2",
  productName: "저당 그래놀라",
  category: "lifestyle",
  priceKrw: 18900,
  thumbnailUrl: null,
  mediaItems: [
    {
      mediaType: "VIDEO",
      thumbnailUrl: "https://example.com/images/granola-video.jpg",
      url: "https://example.com/videos/granola.mp4",
    },
  ],
};

const thirdGroupBuy: GroupBuy = {
  ...firstGroupBuy,
  id: "influencer-deal-3",
  productName: "촉촉 선크림",
  category: "beauty",
  priceKrw: 22900,
  thumbnailUrl: null,
  mediaItems: undefined,
  mediaUrls: ["https://example.com/images/suncream.jpg"],
};

const fourthGroupBuy: GroupBuy = {
  ...firstGroupBuy,
  id: "influencer-deal-4",
  productName: "이미지 준비 중 상품",
  category: "fashion",
  thumbnailUrl: null,
  mediaItems: undefined,
  mediaUrls: [],
};

const queryResult = {
  data: [firstGroupBuy, secondGroupBuy, thirdGroupBuy, fourthGroupBuy],
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};

const useQueryMock = vi.mocked(useQuery);

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

function renderScreen(result: typeof queryResult = queryResult) {
  const navigation = {
    goBack: vi.fn(),
    navigate: vi.fn(),
  };
  let renderer: TestRenderer.ReactTestRenderer;

  useQueryMock.mockReturnValue(result as never);
  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <InfluencerGroupBuysScreen
          navigation={navigation as never}
          route={
            {
              key: "influencer-group-buys",
              name: "InfluencerGroupBuys",
              params: {
                influencerDisplayName: "(목) (토)",
                influencerProfileImageUrl: null,
                influencerUsername: "@bada_ummaya",
              },
            } as never
          }
        />
      </ThemeProvider>,
    );
  });

  return { navigation, renderer: renderer! };
}

describe("InfluencerGroupBuysScreen", () => {
  beforeEach(() => {
    queryResult.refetch.mockReset();
    useQueryMock.mockReset();
  });

  it("uses the shared centered header and keeps only the influencer identity below it", () => {
    const { navigation, renderer } = renderScreen();
    const text = flattenText(renderer.toJSON()).replace(/\s+/g, " ");
    const headerTitle = renderer.root
      .findAllByProps({ testID: "influencer-group-buys-header-title" })
      .find((node) => String(node.type) === "Text");
    const backButton = renderer.root.findByProps({
      testID: "influencer-group-buys-back-button",
    });
    const profileAvatar = renderer.root.findByProps({
      testID: "influencer-group-buys-profile-avatar",
    });

    expect(headerTitle?.props.children).toBe("인플루언서 공구");
    expect(text).toContain("@bada_ummaya");
    expect(profileAvatar.props.profileImageUrl).toBe(
      "https://example.com/images/bada.jpg",
    );
    expect(text).not.toContain("Influencer GongGu");
    expect(text).not.toContain("(목) (토)의 공동구매 목록");
    expect(text).not.toContain("검색으로 돌아가기");
    expect(text).not.toContain("신뢰도");

    act(() => backButton.props.onPress());
    expect(navigation.goBack).toHaveBeenCalledOnce();
  });

  it("renders a one-column divided list with images and basic deal data", () => {
    const { navigation, renderer } = renderScreen();
    const text = flattenText(renderer.toJSON()).replace(/\s+/g, " ");
    const list = renderer.root.findByType(
      "FlatList" as unknown as React.ElementType,
    );
    const images = renderer.root.findAllByType(
      "ExpoImage" as unknown as React.ElementType,
    );
    const rows = [firstGroupBuy, secondGroupBuy, thirdGroupBuy, fourthGroupBuy].map(
      (item) => renderer.root.findByProps({ testID: `influencer-deal-row-${item.id}` }),
    );
    const detailActions = [
      firstGroupBuy,
      secondGroupBuy,
      thirdGroupBuy,
      fourthGroupBuy,
    ].map((item) =>
      renderer.root.findByProps({
        testID: `influencer-deal-detail-${item.id}`,
      }),
    );

    expect(list.props.numColumns).toBeUndefined();
    expect(list.props.columnWrapperStyle).toBeUndefined();
    expect(list.props.ItemSeparatorComponent().props.testID).toBe(
      "influencer-deal-separator",
    );
    expect(images.map((image) => image.props.source?.uri)).toEqual([
      "https://example.com/images/duck.jpg",
      "https://example.com/images/granola-video.jpg",
      "https://example.com/images/suncream.jpg",
    ]);
    expect(images.map((image) => image.props.recyclingKey)).toEqual([
      "influencer-deal-1",
      "influencer-deal-2",
      "influencer-deal-3",
    ]);
    expect(
      renderer.root.findByProps({
        testID: "influencer-deal-image-fallback-influencer-deal-4",
      }),
    ).toBeTruthy();
    expect(text).toContain("국내산 오리고기");
    expect(text).toContain("35,900원");
    expect(text).toContain("최대 64,000원 할인");
    expect(text).toContain("8월 6일 ~ 8월 21일");
    expect(rows).toHaveLength(4);
    expect(
      renderer.root.findAllByType(
        "GroupBuyReminderButton" as unknown as React.ElementType,
      ),
    ).toHaveLength(4);

    const firstRowContent = renderer.root.findByProps({
      testID: `influencer-deal-content-${firstGroupBuy.id}`,
    });
    expect(firstRowContent.props.style).toMatchObject({ flexDirection: "row" });
    const flattenedRowStyle = Object.assign({}, rows[0].props.style);
    expect(flattenedRowStyle).not.toHaveProperty("backgroundColor");
    expect(flattenedRowStyle).not.toHaveProperty("borderRadius");
    expect(flattenedRowStyle).not.toHaveProperty("borderWidth");
    expect(rows[0].props.onPress).toBeUndefined();
    expect(
      detailActions[0].findAllByType(
        "GroupBuyReminderButton" as unknown as React.ElementType,
      ),
    ).toHaveLength(0);

    act(() => detailActions[0].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("Detail", {
      groupBuy: firstGroupBuy,
    });

    act(() => images[0].props.onError());
    expect(
      renderer.root.findByProps({
        testID: "influencer-deal-image-fallback-influencer-deal-1",
      }),
    ).toBeTruthy();
  });

  it("keeps loading, empty, error, and pull-to-refresh states", () => {
    const loading = renderScreen({
      ...queryResult,
      data: [],
      isFetching: true,
    });
    expect(
      loading.renderer.root.findAllByType(
        "ActivityIndicator" as unknown as React.ElementType,
      ),
    ).toHaveLength(1);

    const empty = renderScreen({ ...queryResult, data: [] });
    expect(flattenText(empty.renderer.toJSON())).toContain(
      "아직 표시할 공구가 없어요",
    );

    const error = renderScreen({
      ...queryResult,
      data: [],
      isError: true,
    });
    expect(flattenText(error.renderer.toJSON())).toContain(
      "공구 정보를 불러오지 못했어요",
    );

    const refreshControl = error.renderer.root.findByType(
      "FlatList" as unknown as React.ElementType,
    ).props.refreshControl;
    act(() => refreshControl.props.onRefresh());
    expect(queryResult.refetch).toHaveBeenCalledOnce();
  });
});
