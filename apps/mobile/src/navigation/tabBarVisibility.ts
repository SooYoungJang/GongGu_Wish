import { createElement, useEffect, useState } from "react";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";

import {
  BOTTOM_SHEET_ACCESSIBILITY_BUFFER_MS,
  REELS_SUMMARY_SHEET_ANIMATION_MS,
} from "../design/bottomSheetMotion";

export type TabBarVisibilityStyle = {
  bottom: number;
};

export const TAB_BAR_ACCESSIBILITY_SETTLE_MS =
  REELS_SUMMARY_SHEET_ANIMATION_MS + BOTTOM_SHEET_ACCESSIBILITY_BUFFER_MS;

export function getTabBarVisibilityStyle(
  hidden: boolean,
  tabBarHeight: number,
): TabBarVisibilityStyle {
  return { bottom: hidden ? -tabBarHeight : 0 };
}

export function getTabBarButtonVisibilityProps(hidden: boolean) {
  return {
    accessible: !hidden,
    accessibilityElementsHidden: hidden,
    importantForAccessibility: hidden
      ? ("no-hide-descendants" as const)
      : ("auto" as const),
    pointerEvents: hidden ? ("none" as const) : ("auto" as const),
  };
}

type DeferredTabBarButtonProps = BottomTabBarButtonProps & {
  visibilityHidden: boolean;
};

export function DeferredTabBarButton({
  visibilityHidden,
  ...props
}: DeferredTabBarButtonProps) {
  const accessibilityHidden =
    useDeferredTabBarAccessibilityHidden(visibilityHidden);

  return createElement(PlatformPressable, {
    ...props,
    ...getTabBarButtonVisibilityProps(accessibilityHidden),
  });
}

export function createTabBarButtonRenderer(hidden: boolean) {
  return (props: BottomTabBarButtonProps) =>
    createElement(DeferredTabBarButton, {
      ...props,
      visibilityHidden: hidden,
    });
}

export function useDeferredTabBarAccessibilityHidden(hidden: boolean) {
  const [accessibilityHidden, setAccessibilityHidden] = useState(hidden);

  useEffect(() => {
    if (hidden === accessibilityHidden) return;

    const timeout = setTimeout(() => {
      setAccessibilityHidden(hidden);
    }, TAB_BAR_ACCESSIBILITY_SETTLE_MS);

    return () => clearTimeout(timeout);
  }, [accessibilityHidden, hidden]);

  return accessibilityHidden;
}
