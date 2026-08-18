import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InstagramIdentity } from "./InstagramIdentity";

vi.mock("react-native", () => ({
  Pressable: ({
    children,
    ...props
  }: {
    children?: unknown;
  }) => {
    const ReactMock = require("react");
    return ReactMock.createElement(
      "Pressable",
      props,
      (typeof children === "function"
        ? children({ pressed: false })
        : children) as React.ReactNode,
    );
  },
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("View", props, children);
  },
}));

const navigationMock = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => navigationMock,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("Ionicons", props);
  },
}));

vi.mock("./InstagramProfileAvatar", () => ({
  InstagramProfileAvatar: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("InstagramProfileAvatar", props);
  },
}));

vi.mock("./SText", () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("SText", props, children);
  },
}));

vi.mock("../../design/useCommerceTheme", () => ({
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

describe("InstagramIdentity", () => {
  beforeEach(() => {
    navigationMock.navigate.mockReset();
  });

  it("normalizes the account and renders its profile avatar without an Instagram icon", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramIdentity
          avatarTestID="instagram-avatar"
          profileImageUrl="https://cdn.example.com/sample.jpg"
          testID="instagram-account"
          username="@@sample_shop"
        />,
      );
    });

    expect(flattenText(renderer!.toJSON())).toBe("@sample_shop");
    expect(
      renderer!.root.findByProps({ testID: "instagram-avatar" }).props,
    ).toMatchObject({
      profileImageUrl: "https://cdn.example.com/sample.jpg",
      size: 16,
      username: "@@sample_shop",
    });
    expect(renderer!.root.findAllByType("Ionicons" as unknown as React.ElementType)).toHaveLength(0);
    const account = renderer!.root
      .findAllByType("SText" as unknown as React.ElementType)
      .find((node) => node.props.testID === "instagram-account");
    expect(account?.props).toMatchObject({ numberOfLines: 1 });
  });

  it("uses inverse colors on media overlays", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramIdentity
          avatarTestID="inverse-avatar"
          tone="inverse"
          username="sample"
        />,
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "inverse-avatar" }).props.tone,
    ).toBe("inverse");
    const text = renderer!.root.findByType(
      "SText" as unknown as React.ElementType,
    );
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
  });

  it("opens the matching influencer deals and stops a parent product press", () => {
    const stopPropagation = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramIdentity
          profileImageUrl="https://cdn.example.com/sample.jpg"
          username="@@sample_shop"
        />,
      );
    });

    const link = renderer!.root.findByType(
      "Pressable" as unknown as React.ElementType,
    );

    expect(link.props).toMatchObject({
      accessible: true,
      accessibilityLabel: "@sample_shop 인플루언서 공구 보기",
      accessibilityRole: "button",
    });

    act(() => link.props.onPress({ stopPropagation }));

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(navigationMock.navigate).toHaveBeenCalledWith("InfluencerGroupBuys", {
      influencerDisplayName: null,
      influencerProfileImageUrl: "https://cdn.example.com/sample.jpg",
      influencerUsername: "sample_shop",
    });
  });

  it("can remain static on the influencer's own screen", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramIdentity navigationEnabled={false} username="sample_shop" />,
      );
    });

    expect(
      renderer!.root.findAllByType(
        "Pressable" as unknown as React.ElementType,
      ),
    ).toHaveLength(0);
    expect(flattenText(renderer!.toJSON())).toBe("@sample_shop");
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "unknown", "@unknown"])(
    "renders nothing for a missing account (%s)",
    (username) => {
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <InstagramIdentity username={username} />,
        );
      });

      expect(renderer!.toJSON()).toBeNull();
    },
  );
});
