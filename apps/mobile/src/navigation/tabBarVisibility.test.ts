import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { PlatformPressable } from "@react-navigation/elements";
import {
  act as rendererAct,
  create as createRenderer,
  type ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOTTOM_SHEET_ACCESSIBILITY_BUFFER_MS,
  REELS_SUMMARY_SHEET_ANIMATION_MS,
} from "../design/bottomSheetMotion";
import {
  TAB_BAR_ACCESSIBILITY_SETTLE_MS,
  createTabBarButtonRenderer,
  getTabBarButtonVisibilityProps,
  getTabBarVisibilityStyle,
  useDeferredTabBarAccessibilityHidden,
} from "./tabBarVisibility";

vi.mock("@react-navigation/elements", () => ({
  PlatformPressable: "PlatformPressable",
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("getTabBarVisibilityStyle", () => {
  it("keeps the tab bar mounted while moving it outside the viewport", () => {
    expect(getTabBarVisibilityStyle(true, 64)).toEqual({ bottom: -64 });
    expect(getTabBarVisibilityStyle(false, 64)).toEqual({ bottom: 0 });
  });

  it("wires the mounted tab bar behavior into the actual MainTabs options", () => {
    const appSource = readFileSync("src/App.tsx", "utf8");
    const mainTabsSource = appSource.slice(
      appSource.indexOf("function MainTabs"),
      appSource.indexOf("function QueryFocusBridge"),
    );

    expect(mainTabsSource).toMatch(/tabBarButton:\s*renderTabBarButton/);
    expect(mainTabsSource).toMatch(
      /getTabBarVisibilityStyle\(reelsSheetOpen,\s*tabBarHeight\)/,
    );
    expect(mainTabsSource).not.toMatch(/\bdisplay\s*:/);
  });

  it("removes only hidden tab buttons from interaction and accessibility", () => {
    expect(getTabBarButtonVisibilityProps(true)).toEqual({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
      pointerEvents: "none",
    });
    expect(getTabBarButtonVisibilityProps(false)).toEqual({
      accessible: true,
      accessibilityElementsHidden: false,
      importantForAccessibility: "auto",
      pointerEvents: "auto",
    });
  });

  it("passes hidden-state props to the actual tab pressable", () => {
    const onPress = vi.fn();
    let buttonTree: ReactTestRenderer | undefined;

    rendererAct(() => {
      buttonTree = createRenderer(
        createTabBarButtonRenderer(true)({
          children: null,
          onPress,
        } as never),
      );
    });

    const button = buttonTree?.root.findByType(PlatformPressable as never);
    const props = button?.props as Record<string, unknown>;

    expect(props.onPress).toBe(onPress);
    expect(props.accessible).toBe(false);
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe("no-hide-descendants");
    expect(props.pointerEvents).toBe("none");

    rendererAct(() => buttonTree?.unmount());
  });

  it("derives accessibility settling from the sheet animation duration", () => {
    expect(TAB_BAR_ACCESSIBILITY_SETTLE_MS).toBe(
      REELS_SUMMARY_SHEET_ANIMATION_MS + BOTTOM_SHEET_ACCESSIBILITY_BUFFER_MS,
    );
  });

  it("defers accessibility-tree changes until the sheet animation settles", () => {
    vi.useFakeTimers();
    const visibility = renderHook(
      ({ hidden }) => useDeferredTabBarAccessibilityHidden(hidden),
      { initialProps: { hidden: false } },
    );

    visibility.rerender({ hidden: true });
    expect(visibility.result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS - 1);
    });
    expect(visibility.result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(visibility.result.current).toBe(true);

    visibility.rerender({ hidden: false });
    expect(visibility.result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS);
    });
    expect(visibility.result.current).toBe(false);
  });

  it("cancels a pending hide when the sheet closes immediately", () => {
    vi.useFakeTimers();
    const visibility = renderHook(
      ({ hidden }) => useDeferredTabBarAccessibilityHidden(hidden),
      { initialProps: { hidden: false } },
    );

    visibility.rerender({ hidden: true });
    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS / 2);
    });
    visibility.rerender({ hidden: false });
    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS);
    });

    expect(visibility.result.current).toBe(false);
  });

  it("cancels a pending reveal when the sheet reopens immediately", () => {
    vi.useFakeTimers();
    const visibility = renderHook(
      ({ hidden }) => useDeferredTabBarAccessibilityHidden(hidden),
      { initialProps: { hidden: false } },
    );

    visibility.rerender({ hidden: true });
    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS);
    });
    expect(visibility.result.current).toBe(true);

    visibility.rerender({ hidden: false });
    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS / 2);
    });
    visibility.rerender({ hidden: true });
    act(() => {
      vi.advanceTimersByTime(TAB_BAR_ACCESSIBILITY_SETTLE_MS);
    });

    expect(visibility.result.current).toBe(true);
  });
});
