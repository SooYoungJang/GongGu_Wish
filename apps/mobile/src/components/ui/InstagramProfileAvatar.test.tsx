import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { InstagramProfileAvatar } from "./InstagramProfileAvatar";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("View", props, children);
  },
}));

vi.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => {
    const ReactMock = require("react");
    return ReactMock.createElement("ExpoImage", props);
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
      accentSoft: "#FFF1F4",
      border: "#E5E7EB",
      inverse: "#FFFFFF",
      overlay: "rgba(17, 24, 39, 0.46)",
    },
  }),
}));

describe("InstagramProfileAvatar", () => {
  it("renders a cached Expo image with an accessible profile label", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramProfileAvatar
          imageTestID="profile-image"
          profileImageUrl=" https://cdn.example.com/profile.jpg "
          size={24}
          testID="profile-avatar"
          username="@@sample_shop"
        />,
      );
    });

    const avatar = renderer!.root.find(
      (node) =>
        String(node.type) === "View" && node.props.testID === "profile-avatar",
    );
    expect(avatar.props).toMatchObject({
      accessibilityLabel: "@sample_shop 프로필 이미지",
      accessibilityRole: "image",
      accessible: true,
    });
    expect(
      renderer!.root.findByProps({ testID: "profile-image" }).props,
    ).toMatchObject({
      accessible: false,
      cachePolicy: "memory-disk",
      contentFit: "cover",
      recyclingKey: "https://cdn.example.com/profile.jpg",
      source: { uri: "https://cdn.example.com/profile.jpg" },
    });
  });

  it("falls back to the username initial when the image fails", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramProfileAvatar
          fallbackTestID="profile-fallback"
          imageTestID="profile-image"
          profileImageUrl="https://cdn.example.com/broken.jpg"
          username="beauty_pick"
        />,
      );
    });

    act(() => {
      renderer!.root.findByProps({ testID: "profile-image" }).props.onError();
    });

    expect(
      renderer!.root.findAllByProps({ testID: "profile-image" }),
    ).toHaveLength(0);
    const fallback = renderer!.root.find(
      (node) =>
        String(node.type) === "SText" &&
        node.props.testID === "profile-fallback",
    );
    expect(fallback.children).toEqual(["B"]);
  });

  it("uses inverse theme tokens for a media overlay fallback", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InstagramProfileAvatar
          fallbackTestID="inverse-fallback"
          tone="inverse"
          username="seller"
        />,
      );
    });

    const avatar = renderer!.root.findByType(
      "View" as unknown as React.ElementType,
    );
    expect(avatar.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: "rgba(17, 24, 39, 0.46)",
          borderColor: "#FFFFFF",
        }),
      ]),
    );
    expect(
      renderer!.root.findByProps({ testID: "inverse-fallback" }).props.style,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
  });
});
