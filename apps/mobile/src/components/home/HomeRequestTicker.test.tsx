import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeRequestTicker } from "./HomeRequestTicker";
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
  const passthrough =
    (type: string) =>
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
      border: "#D8DDE5",
      borderLight: "#E5E7EB",
      divider: "#E5E7EB",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      panelBg: "#FFFFFF",
      softBg: "#F3F4F6",
      surface: "#FFFFFF",
      text: "#111827",
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

function getTickerMessage(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: "home-request-ticker-message" });
}

describe("HomeRequestTicker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("한 줄로 유지하고 3초마다 상위 10개를 애니메이션과 함께 순환한다", () => {
    vi.useFakeTimers();
    mocks.timing.mockClear();

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <HomeRequestTicker onPressRanking={vi.fn()} rankings={rankings} />,
      );
    });

    expect(getTickerMessage(renderer!).props.accessibilityLabel).toBe(
      "공구 요청 1위, 상품 1",
    );
    expect(getTickerMessage(renderer!).props.accessibilityRole).toBe("button");
    expect(
      renderer!.root.findByProps({ testID: "home-request-ticker" }).props
        .style[0],
    ).toMatchObject({ minHeight: 40 });
    expect(getTickerMessage(renderer!).props.hitSlop).toEqual({
      bottom: 2,
      top: 2,
    });
    expect(getTickerMessage(renderer!).props.style).toMatchObject({
      flex: 1,
      minHeight: 40,
    });
    expect(
      renderer!.root.findAllByProps({ testID: "home-request-ticker-message" }),
    ).not.toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(getTickerMessage(renderer!).props.accessibilityLabel).toBe(
      "공구 요청 1위, 상품 1",
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(getTickerMessage(renderer!).props.accessibilityLabel).toBe(
      "공구 요청 2위, 상품 2",
    );
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("요청 99건");
    expect(JSON.stringify(renderer!.toJSON())).toContain("공구 요청 2위");
    expect(JSON.stringify(renderer!.toJSON())).toContain("상품 2");
    expect(mocks.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: 420,
        easing: expect.anything(),
        useNativeDriver: true,
      }),
    );

    const swipeSurface = renderer!.root.findByProps({
      testID: "home-request-ticker-swipe-surface",
    });
    expect(swipeSurface.props.style[0]).toMatchObject({
      flex: 1,
      minHeight: 40,
    });
    const animatedStyle = swipeSurface.props.style[1];
    expect(animatedStyle.transform).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ translateY: expect.anything() }),
      ]),
    );
    expect(
      swipeSurface.findAllByProps({ testID: "home-request-ticker-glyph" }),
    ).toHaveLength(0);
    expect(
      renderer!.root.findByProps({ testID: "home-request-ticker-glyph" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "home-request-ticker-rank" }).props
        .style,
    ).toMatchObject({ backgroundColor: "#E45757" });

    renderer!.unmount();
  });

  it("스와이프로 다음 항목을 보고 상품 검색 탭을 연결한다", () => {
    const onPressRanking = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <HomeRequestTicker
          onPressRanking={onPressRanking}
          rankings={rankings}
        />,
      );
    });
    const swipeSurface = renderer!.root.findByProps({
      testID: "home-request-ticker-swipe-surface",
    });

    expect(swipeSurface.props.accessibilityHint).toBe(
      "좌우로 밀어 다음 또는 이전 공구 요청을 볼 수 있어요",
    );
    act(() => {
      swipeSurface.props.onPanResponderRelease({}, { dx: -60, dy: 4 });
    });
    expect(getTickerMessage(renderer!).props.accessibilityLabel).toBe(
      "공구 요청 2위, 상품 2",
    );

    act(() => {
      getTickerMessage(renderer!).props.onPress();
    });
    expect(onPressRanking).toHaveBeenCalledWith("상품 2");
    expect(getTickerMessage(renderer!).props.style).toMatchObject({
      flex: 1,
      minHeight: 40,
    });

    renderer!.unmount();
  });

  it("요청 순위가 없으면 렌더링하지 않는다", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <HomeRequestTicker onPressRanking={vi.fn()} rankings={[]} />,
      );
    });

    expect(
      renderer!.root.findAllByProps({ testID: "home-request-ticker" }),
    ).toHaveLength(0);
    renderer!.unmount();
  });
});
