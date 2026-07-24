import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { CenteredBackHeader } from "../CenteredBackHeader";
import { ThemeProvider } from "../../context/ThemeContext";
import { spacing } from "../../design/tokens";

function flattenStyle(style: unknown): Record<string, unknown> {
  const values = Array.isArray(style) ? style : [style];
  return values.reduce<Record<string, unknown>>((result, value) => {
    if (value && typeof value === "object") {
      Object.assign(result, value);
    }
    return result;
  }, {});
}

describe("CenteredBackHeader", () => {
  it("keeps the back button inset while centering the title between equal side slots", () => {
    const onBack = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <CenteredBackHeader
            onBack={onBack}
            testID="shared-navigation-header"
            title="공구위시"
          />
        </ThemeProvider>,
      );
    });

    const header = renderer!.root
      .findAllByProps({ testID: "shared-navigation-header" })
      .find((node) => node.type === View);
    const title = renderer!.root.findByProps({
      testID: "shared-navigation-header-title",
    });
    const leading = renderer!.root.findByProps({
      testID: "shared-navigation-header-leading",
    });
    const trailing = renderer!.root.findByProps({
      testID: "shared-navigation-header-trailing",
    });
    const backButton = renderer!.root.findByType(Pressable);

    expect(header).toBeDefined();
    expect(flattenStyle(header!.props.style)).toMatchObject({
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    });
    expect(flattenStyle(leading.props.style)).toMatchObject({
      height: 44,
      width: 44,
    });
    expect(flattenStyle(trailing.props.style)).toMatchObject({
      height: 44,
      width: 44,
    });
    expect(title.type).toBe(Text);
    expect(title.props.children).toBe("공구위시");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flattenStyle(title.props.style)).toMatchObject({
      flex: 1,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 26,
      textAlign: "center",
    });

    act(() => {
      backButton.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps overlay titles on the shared typography scale", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <CenteredBackHeader
            testID="overlay-navigation-header"
            title="릴스"
            titleVariant="overlay"
          />
        </ThemeProvider>,
      );
    });

    const title = renderer!.root.findByProps({
      testID: "overlay-navigation-header-title",
    });

    expect(flattenStyle(title.props.style)).toMatchObject({
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 26,
      textShadowColor: "rgba(0,0,0,0.36)",
    });
  });
});
