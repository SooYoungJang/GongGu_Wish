import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-image", () => ({
  Image: "ExpoImage",
}));

import {
  WARM_COMMERCE_SPLASH_BACKGROUND,
  WarmCommerceSplashScreen,
} from "./WarmCommerceSplashScreen";

describe("WarmCommerceSplashScreen", () => {
  it("fills the launch surface and signals after the portrait artwork is displayed", async () => {
    const onReady = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <WarmCommerceSplashScreen onReady={onReady} />,
      );
    });

    const surface = renderer.root.findByProps({
      testID: "warm-commerce-splash",
    });
    const image = renderer.root.findByProps({
      testID: "warm-commerce-splash-artwork",
    });

    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      backgroundColor: WARM_COMMERCE_SPLASH_BACKGROUND,
      flex: 1,
    });
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    });
    expect(image.props.contentFit).toBe("cover");
    expect(image.props.priority).toBe("high");
    expect(onReady).not.toHaveBeenCalled();

    await act(async () => {
      image.props.onDisplay();
    });

    expect(onReady).toHaveBeenCalledOnce();
  });
});
