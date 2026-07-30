import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { InfluencerCard } from "./InfluencerCard";

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
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

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      border: "#E5E7EB",
      primary: "#F0445E",
      primaryBg: "#FFF1F4",
      surface: "#FFFFFF",
    },
    shadows: { lg: {}, md: {}, sm: {} },
  }),
}));

vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#F0445E",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      text: "#111827",
    },
  }),
}));

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join("") ?? ""
  );
}

describe("InfluencerCard", () => {
  it("shows an account once with the Instagram icon when there is no display name", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InfluencerCard
          influencer={{
            displayName: null,
            id: "influencer-1",
            instagramUsername: "sample_shop",
            isActive: true,
          }}
          onPress={vi.fn()}
        />,
      );
    });

    expect(flattenText(renderer!.toJSON()).match(/@sample_shop/g)).toHaveLength(
      1,
    );
    expect(
      renderer!.root.findByProps({ name: "logo-instagram" }).props,
    ).toMatchObject({ accessible: false, color: "#F0445E" });
  });

  it("keeps the display name above the Instagram identity", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InfluencerCard
          influencer={{
            displayName: "샘플 상점",
            id: "influencer-2",
            instagramUsername: "sample_shop",
            isActive: true,
          }}
          onPress={vi.fn()}
        />,
      );
    });

    const text = flattenText(renderer!.toJSON());
    expect(text).toContain("샘플 상점");
    expect(text.match(/@sample_shop/g)).toHaveLength(1);
  });
});
