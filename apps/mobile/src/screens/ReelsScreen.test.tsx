import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReelsScreen } from "./ReelsScreen";

const appStateMock = vi.hoisted(() => ({
  currentState: "active",
  listener: null as null | React.Dispatch<string>,
}));

const focusMock = vi.hoisted(() => ({
  blur: null as null | (() => void),
}));

const recordViewMock = vi.hoisted(() => vi.fn());
const logDeepViewMock = vi.hoisted(() => vi.fn());

const groupBuys = [0, 1, 2].map((index) => ({
  id: `reel-${index}`,
  productName: `릴스 ${index}`,
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    AppState: {
      get currentState() {
        return appStateMock.currentState;
      },
      addEventListener: vi.fn(
        (_event: string, listener: React.Dispatch<string>) => {
          appStateMock.listener = listener;
          return { remove: vi.fn() };
        },
      ),
    },
    Platform: { OS: "android" },
    StatusBar: passthrough("StatusBar"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useWindowDimensions: () => ({ width: 360, height: 720 }),
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactMock = require("react");
    ReactMock.useEffect(() => {
      const cleanup = effect();
      focusMock.blur = typeof cleanup === "function" ? cleanup : null;
      return () => {
        focusMock.blur = null;
      };
    }, [effect]);
  },
  useNavigation: () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: groupBuys }),
}));

vi.mock("react-native-pager-view", () => {
  const ReactMock = require("react");
  return {
    default: ReactMock.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactMock.useImperativeHandle(ref, () => ({
          setPageWithoutAnimation: vi.fn(),
        }));
        return ReactMock.createElement("PagerView", props, props.children);
      },
    ),
  };
});

vi.mock("../api", () => ({
  fetchGroupBuys: vi.fn(),
  logDeepView: logDeepViewMock,
}));

vi.mock("../hooks/useLocalDeals", () => ({
  useRecentViews: () => ({ recordView: recordViewMock }),
}));

vi.mock("../hooks/useTabReselect", () => ({
  useTabReselect: vi.fn(),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ colors: {}, shadows: {} }),
}));

vi.mock("./reelNavigation", () => ({
  getRandomReelIndex: () => 0,
}));

vi.mock("./DetailScreen", () => {
  const ReactMock = require("react");
  return {
    makeStyles: () => ({
      safeArea: {},
      verticalPager: {},
      verticalPagerPage: {},
    }),
    ProductReelPage: (props: Record<string, unknown>) =>
      ReactMock.createElement("ProductReelPage", props),
    ReelVideoPreloader: (props: Record<string, unknown>) =>
      ReactMock.createElement("ReelVideoPreloader", props),
  };
});

describe("ReelsScreen player lifecycle", () => {
  beforeEach(() => {
    appStateMock.currentState = "active";
    appStateMock.listener = null;
    focusMock.blur = null;
    recordViewMock.mockClear();
    logDeepViewMock.mockReset();
    logDeepViewMock.mockResolvedValue(undefined);
  });

  it("keeps the preloader mounted while backgrounded, but releases it after leaving Reels", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPreloaders = () =>
      renderer!.root.findAll(
        (node) => String(node.type) === "ReelVideoPreloader",
      );

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);

    act(() => {
      appStateMock.listener?.("background");
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(false);

    act(() => {
      appStateMock.listener?.("active");
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);

    act(() => {
      focusMock.blur?.();
    });

    expect(findPreloaders()).toHaveLength(0);

    act(() => {
      renderer!.unmount();
    });
  });

  it("does not leak a rejected deep-view request after staying idle on a reel", async () => {
    vi.useFakeTimers();
    logDeepViewMock.mockRejectedValue(
      new TypeError("Cannot read property 'reload' of undefined"),
    );

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(logDeepViewMock).toHaveBeenCalledTimes(1);
    expect(logDeepViewMock.mock.calls[0]?.[0]).toMatch(/^reel-[0-2]$/);

    act(() => {
      renderer!.unmount();
    });
    vi.useRealTimers();
  });

  it("keeps the pager page window bounded after repeated forward swipes", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");

    for (let index = 0; index < 100; index += 1) {
      act(() => {
        findPager().props.onPageSelected({ nativeEvent: { position: 5 } });
      });

      const children = findPager().props.children as unknown[];
      expect(children).toHaveLength(7);
      expect(findPager().props.initialPage).toBeGreaterThanOrEqual(0);
      expect(findPager().props.initialPage).toBeLessThan(7);
    }

    act(() => {
      renderer!.unmount();
    });
  });
});
