import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import { DealCard } from "./DealCard";

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

vi.mock("./ui/SText", () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("SText", props, children);
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
  });
});
