import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReelsScreen } from "./ReelsScreen";
import {
  REEL_PAGE_WINDOW_EDGE,
  REEL_PAGE_WINDOW_SIZE,
} from "./reelWindow";

const appStateMock = vi.hoisted(() => ({
  currentState: "active",
  listener: null as null | React.Dispatch<string>,
}));

const focusMock = vi.hoisted(() => ({
  blur: null as null | (() => void),
}));
const playbackLifecycleMock = vi.hoisted(() => ({
  isScreenFocused: true,
  isAppActive: true,
  isAppFocused: true,
}));

const recordViewMock = vi.hoisted(() => vi.fn());
const logDeepViewMock = vi.hoisted(() => vi.fn());
const themeMock = vi.hoisted(() => ({ colors: {}, shadows: {} }));
const queryResultMock = vi.hoisted(() => ({
  data: undefined as Array<Record<string, unknown>> | undefined,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
}));
const pagerViewMock = vi.hoisted(() => ({
  mounts: 0,
  setPageWithoutAnimation: vi.fn(),
}));
const adsMock = vi.hoisted(() => ({
  enabled: false,
  isReady: false,
  nativeUnitIds: { detail: null, home: null, reels: null as string | null },
}));

const groupBuys = [0, 1, 2].map((index) => ({
  id: `reel-${index}`,
  productName: `릴스 ${index}`,
  videoUrl: `https://example.com/reel-${index}.mp4`,
  mediaType: "VIDEO",
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
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
    Pressable: passthrough("Pressable"),
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
  useQuery: () => queryResultMock,
}));

vi.mock("react-native-pager-view", () => {
  const ReactMock = require("react");
  return {
    default: ReactMock.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactMock.useEffect(() => {
          pagerViewMock.mounts += 1;
        }, []);
        ReactMock.useImperativeHandle(ref, () => ({
          setPageWithoutAnimation: pagerViewMock.setPageWithoutAnimation,
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

vi.mock("../hooks/usePlaybackLifecycle", () => ({
  usePlaybackLifecycle: () => ({
    ...playbackLifecycleMock,
    isPlaybackActive:
      playbackLifecycleMock.isScreenFocused &&
      playbackLifecycleMock.isAppActive &&
      playbackLifecycleMock.isAppFocused,
  }),
}));

vi.mock("../hooks/useTabReselect", () => ({
  useTabReselect: vi.fn(),
}));

vi.mock("../ads/AdsContext", () => ({
  useAds: () => adsMock,
}));

vi.mock("../components/ads/NativeAdCard", () => {
  const ReactMock = require("react");
  return {
    NativeAdCard: (props: Record<string, unknown>) =>
      ReactMock.createElement("NativeAdCard", props),
  };
});

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => themeMock,
}));

vi.mock("./reelNavigation", () => ({
  getRandomReelIndex: () => 0,
}));

vi.mock("./DetailScreen", () => {
  const ReactMock = require("react");
  return {
    hasPlayableVideoMedia: (groupBuy?: { videoUrl?: string | null }) =>
      Boolean(groupBuy?.videoUrl),
    makeStyles: () => ({
      safeArea: {},
      verticalPager: {},
      verticalPagerPage: {},
    }),
    ProductReelPage: (props: Record<string, any>) => {
      ReactMock.useEffect(() => {
        props.onPlaybackStateChange?.(
          props.groupBuy.id,
          Boolean(props.isActive),
        );
      }, [props.groupBuy.id, props.isActive, props.onPlaybackStateChange]);
      return ReactMock.createElement("ProductReelPage", props);
    },
    ReelVideoPreloader: (props: Record<string, unknown>) =>
      ReactMock.createElement("ReelVideoPreloader", props),
  };
});

describe("ReelsScreen player lifecycle", () => {
  beforeEach(() => {
    appStateMock.currentState = "active";
    appStateMock.listener = null;
    focusMock.blur = null;
    playbackLifecycleMock.isScreenFocused = true;
    playbackLifecycleMock.isAppActive = true;
    playbackLifecycleMock.isAppFocused = true;
    recordViewMock.mockClear();
    logDeepViewMock.mockReset();
    logDeepViewMock.mockResolvedValue(undefined);
    queryResultMock.data = groupBuys;
    queryResultMock.isError = false;
    queryResultMock.isFetching = false;
    queryResultMock.isLoading = false;
    queryResultMock.refetch.mockClear();
    pagerViewMock.mounts = 0;
    pagerViewMock.setPageWithoutAnimation.mockClear();
    adsMock.enabled = false;
    adsMock.isReady = false;
    adsMock.nativeUnitIds.reels = null;
  });

  it("keeps a native ad above the Reels tab bar chrome", () => {
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const ad = renderer!.root.findByProps({ testID: "reels-native-ad-1" });
    expect(ad.props.reelBottomInset).toBe(40);

    act(() => {
      renderer!.unmount();
    });
    randomSpy.mockRestore();
  });

  it("shows an accessible retry state when reels fail without cache", () => {
    queryResultMock.data = undefined;
    queryResultMock.isError = true;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const notice = renderer!.root.find(
      (node) =>
        node.props.testID === "reels-query-state" &&
        node.props.accessibilityLiveRegion,
    );
    expect(notice.props.accessibilityLiveRegion).toBe("assertive");
    act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: "다시 불러오기" })
        .props.onPress();
    });
    expect(queryResultMock.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached reels playable with a stale notice", () => {
    queryResultMock.isError = true;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    expect(
      renderer!.root.find(
        (node) =>
          node.props.testID === "reels-query-state" &&
          node.props.accessibilityLiveRegion,
      ).props.accessibilityLiveRegion,
    ).toBe("polite");
    expect(
      renderer!.root.findByType("PagerView" as unknown as React.ElementType),
    ).toBeTruthy();
  });

  it("pauses for Android blur or background and releases the preloader after leaving Reels", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const renderScreen = () => <ReelsScreen />;

    act(() => {
      renderer = TestRenderer.create(renderScreen());
    });

    const findPreloaders = () =>
      renderer!.root.findAll(
        (node) => String(node.type) === "ReelVideoPreloader",
      );

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);

    playbackLifecycleMock.isAppFocused = false;
    act(() => {
      renderer!.update(renderScreen());
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(false);

    playbackLifecycleMock.isAppFocused = true;
    act(() => {
      renderer!.update(renderScreen());
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);

    playbackLifecycleMock.isAppActive = false;
    playbackLifecycleMock.isAppFocused = false;
    act(() => {
      renderer!.update(renderScreen());
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(false);

    playbackLifecycleMock.isScreenFocused = false;
    act(() => {
      renderer!.update(renderScreen());
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

    const activePage = renderer!.root.find(
      (node) =>
        String(node.type) === "ProductReelPage" && node.props.isActive === true,
    );
    act(() => {
      activePage.props.onPlaybackStateChange?.(
        activePage.props.groupBuy.id,
        true,
      );
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

  it("restarts deep-view eligibility after a summary sheet closes", async () => {
    vi.useFakeTimers();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPages = () =>
      renderer!.root.findAll((node) => String(node.type) === "ProductReelPage");
    const activePage = findPages().find((node) => node.props.isActive);
    expect(activePage).toBeDefined();

    act(() => {
      activePage!.props.onPlaybackStateChange?.(
        activePage!.props.groupBuy.id,
        true,
      );
      activePage!.props.onSummarySheetStateChange?.(true, false);
      activePage!.props.onSummarySheetStateChange?.(false, true);
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(logDeepViewMock).toHaveBeenCalledTimes(1);

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
        findPager().props.onPageSelected({
          nativeEvent: {
            position: REEL_PAGE_WINDOW_SIZE - REEL_PAGE_WINDOW_EDGE,
          },
        });
      });

      const children = findPager().props.children as unknown[];
      expect(children).toHaveLength(REEL_PAGE_WINDOW_SIZE);
      expect(findPager().props.initialPage).toBeGreaterThanOrEqual(0);
      expect(findPager().props.initialPage).toBeLessThan(
        REEL_PAGE_WINDOW_SIZE,
      );
    }

    act(() => {
      renderer!.unmount();
    });
  });

  it("recenters the existing pager when the bounded window advances", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");

    expect(pagerViewMock.mounts).toBe(1);
    act(() => {
      findPager().props.onPageSelected({
        nativeEvent: {
          position: REEL_PAGE_WINDOW_SIZE - REEL_PAGE_WINDOW_EDGE,
        },
      });
    });

    expect(pagerViewMock.mounts).toBe(1);
    expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledWith(
      REEL_PAGE_WINDOW_EDGE,
    );

    act(() => {
      renderer!.unmount();
    });
  });

  it("keeps the playback callback stable across reel page changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPages = () =>
      renderer!.root.findAll((node) => String(node.type) === "ProductReelPage");
    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");
    const initialCallback = findPages().find((node) => node.props.isActive)
      ?.props.onPlaybackStateChange;

    act(() => {
      findPager().props.onPageSelected({ nativeEvent: { position: 5 } });
    });

    expect(
      findPages().find((node) => node.props.isActive)?.props
        .onPlaybackStateChange,
    ).toBe(initialCallback);

    act(() => {
      renderer!.unmount();
    });
  });

  it("keeps the mute choice across reel page changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPages = () =>
      renderer!.root.findAll((node) => String(node.type) === "ProductReelPage");
    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");
    const activePage = findPages().find((node) => node.props.isActive);

    act(() => {
      activePage?.props.onMutedChange?.(true);
    });

    expect(findPages().every((node) => node.props.muted === true)).toBe(true);

    act(() => {
      findPager().props.onPageSelected({ nativeEvent: { position: 5 } });
    });

    expect(findPages().find((node) => node.props.isActive)?.props.muted).toBe(
      true,
    );

    act(() => {
      renderer!.unmount();
    });
  });

  it("keeps the playing reel active while the summary sheet is open", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPages = () =>
      renderer!.root.findAll((node) => String(node.type) === "ProductReelPage");
    const activePage = findPages().find((node) => node.props.isActive);
    expect(activePage).toBeDefined();

    act(() => {
      activePage!.props.onSummarySheetStateChange(true, false);
    });

    expect(findPages().some((node) => node.props.isActive)).toBe(true);
    expect(
      findPages().find((node) => node.props.isActive)?.props.playbackAllowed,
    ).toBe(true);

    act(() => {
      renderer!.unmount();
    });
  });
});
