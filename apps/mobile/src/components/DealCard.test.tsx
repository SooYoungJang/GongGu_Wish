import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import { buildDealCardAccessibilityLabel, DealCard } from "./DealCard";

const navigationMock = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => navigationMock,
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
    View: passthrough("View"),
  };
});

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("Ionicons", props);
  },
}));

vi.mock("./ui/SText", () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("SText", props, children);
  },
}));

vi.mock("./GroupBuyReminderButton", () => ({
  GroupBuyReminderButton: (props: unknown) => {
    const ReactMock = require("react");
    return ReactMock.createElement("GroupBuyReminderButton", props);
  },
}));

vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#F0445E",
      border: "#E5E7EB",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      overlay: "rgba(24, 24, 27, 0.72)",
      softBg: "#F3F4F6",
      text: "#111827",
    },
  }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ colors: { textPrimary: "#111827" } }),
}));

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

const item: GroupBuy = {
  id: "deal-card-price",
  productName: "제주 감귤 3kg",
  brandName: "귤밭상회",
  category: "food",
  startDate: "2026-01-01",
  endDate: "2099-12-31",
  purchaseUrl: null,
  discountInfo: null,
  priceKrw: 25900,
  summary: null,
  confidence: 1,
  thumbnailUrl: null,
  videoUrl: null,
  mediaUrls: [],
  mediaType: null,
  rawPost: { postUrl: "", influencer: { instagramUsername: "sample" } },
};

describe("DealCard", () => {
  beforeEach(() => {
    navigationMock.navigate.mockReset();
  });

  it("announces product, price, seller, and deadline details", () => {
    expect(
      buildDealCardAccessibilityLabel(
        {
          ...item,
          startDate: "2026-07-17T00:00:00.000Z",
          endDate: "2026-07-20T00:00:00.000Z",
        },
      ),
    ).toBe(
      "제주 감귤 3kg, 가격 25,900원, 판매자 @sample, 7월 17일 ~ 7월 20일, 상세 보기",
    );

    expect(
      buildDealCardAccessibilityLabel({
        ...item,
        discountInfo: "최대 20% 할인",
      }),
    ).toContain("최대 20% 할인");
  });

  it("announces the date range even after the group buy has ended", () => {
    expect(
      buildDealCardAccessibilityLabel(
        {
          ...item,
          startDate: "2026-07-10T00:00:00",
          endDate: "2026-07-16T23:59:59",
        },
      ),
    ).toContain("7월 10일 ~ 7월 16일");
  });

  it("does not announce a product category as a missing seller", () => {
    expect(
      buildDealCardAccessibilityLabel({
        ...item,
        brandName: null,
        rawPost: {
          ...item.rawPost,
          influencer: {
            ...item.rawPost.influencer,
            instagramUsername: "",
          },
        },
      }),
    ).toContain("판매자 정보 미정");
  });

  it("renders the price directly below the product name", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard item={item} category="food" onPress={vi.fn()} />,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(text).toContain("제주 감귤 3kg");
    expect(text).toContain("25,900원");

    const card = renderer!.root
      .findAllByType("Pressable" as unknown as React.ElementType)
      .find((node) => node.props.accessibilityLabel?.includes("상세 보기"))!;
    expect(card).toBeDefined();
    expect(card.props.accessibilityLabel).toContain("가격 25,900원");
    expect(card.props.accessibilityLabel).toContain("판매자 @sample");
    expect(
      renderer!.root.findByType(
        "GroupBuyReminderButton" as unknown as React.ElementType,
      ).props.item,
    ).toEqual(item);
  });

  it("shows only the Instagram handle in the seller slot", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard
          item={{ ...item, thumbnailUrl: "https://example.com/deal.jpg" }}
          category="food"
          onPress={vi.fn()}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(text).toContain("@sample");
    expect(text).not.toContain("귤밭상회");
    expect(text).not.toContain("식품");
    expect(
      renderer!.root
        .findAllByProps({ testID: "deal-card-instagram-avatar" })
        .some((node) => node.props.accessibilityRole === "image"),
    ).toBe(true);
    expect(renderer!.root.findAllByProps({ name: "logo-instagram" })).toHaveLength(0);
  });

  it("opens the seller's deals without triggering the parent product action", () => {
    const onPress = vi.fn();
    const stopPropagation = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard item={item} category="food" onPress={onPress} />,
      );
    });

    const sellerLink = renderer!.root
      .findAllByType("Pressable" as unknown as React.ElementType)
      .find(
        (node) =>
          node.props.accessibilityLabel === "@sample 인플루언서 공구 보기",
      );
    expect(sellerLink).toBeDefined();

    act(() => sellerLink!.props.onPress({ stopPropagation }));

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();
    expect(navigationMock.navigate).toHaveBeenCalledWith(
      "InfluencerGroupBuys",
      {
        influencerDisplayName: null,
        influencerProfileImageUrl: null,
        influencerUsername: "sample",
      },
    );
  });

  it("exposes detail, seller, reminder, and trailing actions as sibling controls", () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard
          item={item}
          category="food"
          onPress={onPress}
          trailingAction={{
            accessibilityLabel: "북마크",
            icon: React.createElement("BookmarkIcon"),
            onPress: vi.fn(),
            testID: "deal-card-bookmark-action",
          }}
        />,
      );
    });

    const card = renderer!.root.findByProps({ testID: "deal-card" });
    const detailAction = renderer!.root.findByProps({
      testID: "deal-card-detail-action",
    });

    expect(card.props.onPress).toBeUndefined();
    expect(card.props.accessibilityRole).toBeUndefined();
    expect(detailAction.findAllByProps({
      accessibilityLabel: "@sample 인플루언서 공구 보기",
    })).toHaveLength(0);
    expect(
      detailAction.findAllByType(
        "GroupBuyReminderButton" as unknown as React.ElementType,
      ),
    ).toHaveLength(0);
    expect(
      detailAction.findAllByProps({ testID: "deal-card-bookmark-action" }),
    ).toHaveLength(0);

    act(() => detailAction.props.onPress());
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("falls back when the selected image cannot be loaded", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard
          item={{
            ...item,
            mediaItems: [
              {
                mediaType: "IMAGE",
                thumbnailUrl: null,
                url: "https://example.com/image-without-thumbnail.jpg",
              },
            ],
          }}
          category="food"
          onPress={vi.fn()}
        />,
      );
    });

    const image = renderer!.root.findByType(
      "Image" as unknown as React.ElementType,
    );
    expect(image.props.source.uri).toBe(
      "https://example.com/image-without-thumbnail.jpg",
    );

    act(() => image.props.onError());
    expect(
      renderer!.root.findByProps({ testID: "deal-card-image-fallback" }),
    ).toBeTruthy();
  });

  it("keeps an empty seller slot when the Instagram account is missing", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard
          item={{
            ...item,
            thumbnailUrl: "https://example.com/deal.jpg",
            rawPost: {
              ...item.rawPost,
              influencer: {
                ...item.rawPost.influencer,
                instagramUsername: "",
              },
            },
          }}
          category="food"
          onPress={vi.fn()}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    const sellerSlot = renderer!.root.findByProps({
      testID: "deal-card-instagram-slot",
    });

    expect(text).not.toContain("귤밭상회");
    expect(text).not.toContain("식품");
    expect(sellerSlot.props.style).toMatchObject({ minHeight: 18 });
  });

  it("isolates a trailing action from the parent card navigation", () => {
    const onPress = vi.fn();
    const onActionPress = vi.fn();
    const stopPropagation = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <DealCard
          item={item}
          category="food"
          onPress={onPress}
          trailingAction={{
            accessibilityHint: "북마크 목록에서 제거합니다.",
            accessibilityLabel: "제주 감귤 3kg 북마크 해제",
            icon: React.createElement("BookmarkIcon"),
            onPress: onActionPress,
            selected: true,
            testID: "deal-card-bookmark-action",
          }}
        />,
      );
    });

    const action = renderer!.root.findByProps({
      testID: "deal-card-bookmark-action",
    });
    expect(action.props.accessibilityRole).toBe("button");
    expect(action.props.accessibilityState).toEqual({ selected: true });
    expect(action.props.hitSlop).toBe(6);

    act(() => action.props.onPress({ stopPropagation }));

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onActionPress).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();
  });
});
