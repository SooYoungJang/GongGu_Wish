import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupBuyRequestRankingCard } from "./GroupBuyRequestRankingCard";
import type { GroupBuyRequestRanking } from "../../features/groupBuyRequests";

const mocks = vi.hoisted(() => {
  class MockAnimatedValue {
    setValue = vi.fn();
    stopAnimation = vi.fn();
    interpolate = vi.fn((config: unknown) => config);
  }

  return {
    MockAnimatedValue,
    timing: vi.fn(() => ({ start: vi.fn() })),
  };
});

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Animated: {
      Value: mocks.MockAnimatedValue,
      View: passthrough("Animated.View"),
      timing: mocks.timing,
    },
    Easing: {
      cubic: vi.fn(),
      out: (easing: unknown) => easing,
    },
    PanResponder: {
      create: (handlers: unknown) => ({ panHandlers: handlers }),
    },
    Pressable: passthrough("Pressable"),
    StyleSheet: {
      create: (styles: unknown) => styles,
      hairlineWidth: 1,
    },
    View: passthrough("View"),
  };
});

vi.mock("../../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#E45757",
      borderLight: "#E5E7EB",
      divider: "#E5E7EB",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      softBg: "#F3F4F6",
      surface: "#FFFFFF",
      text: "#111827",
      warning: "#B45309",
      weak: "#9CA3AF",
    },
    shadow: {},
  }),
}));

vi.mock("../../hooks/useAccessibilityAutoPlayPause", () => ({
  useAccessibilityAutoPlayPause: () => false,
}));

vi.mock("../ui/SText", () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("SText", props, children),
}));

const rankings: GroupBuyRequestRanking[] = Array.from(
  { length: 10 },
  (_, index) => ({
    rank: index + 1,
    requestId: `request-${index + 1}`,
    productName: `상품 ${index + 1}`,
    requestCount: 100 - index,
  }),
);

function hasTestId(
  renderer: TestRenderer.ReactTestRenderer,
  testID: string,
) {
  return renderer.root.findAllByProps({ testID }).length > 0;
}

describe("GroupBuyRequestRankingCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("자동 전환을 3초마다 실행하고 부드러운 스와이프 전환을 적용한다", () => {
    vi.useFakeTimers();
    mocks.timing.mockClear();

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyRequestRankingCard
          isError={false}
          isFetching={false}
          onPressRanking={vi.fn()}
          onRetry={vi.fn()}
          rankings={rankings}
        />,
      );
    });

    expect(hasTestId(renderer!, "group-buy-request-rank-badge-1")).toBe(true);
    expect(hasTestId(renderer!, "group-buy-request-rank-badge-3")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(hasTestId(renderer!, "group-buy-request-rank-badge-3")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(hasTestId(renderer!, "group-buy-request-rank-badge-3")).toBe(true);
    expect(mocks.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: 420,
        easing: expect.anything(),
        useNativeDriver: true,
      }),
    );

    const surface = renderer!.root.findByProps({
      testID: "group-buy-request-ranking-swipe-surface",
    });
    const animatedStyle = surface.props.style[1];
    expect(animatedStyle.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ scale: expect.anything() })]),
    );

    renderer!.unmount();
  });
});
