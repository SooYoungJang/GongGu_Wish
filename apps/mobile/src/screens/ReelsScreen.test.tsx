import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReelsScreen } from "./ReelsScreen";
import { setMediaMuted } from "../hooks/useMediaMutePreference";
import { REEL_PAGE_WINDOW_EDGE, REEL_PAGE_WINDOW_SIZE } from "./reelWindow";

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
  emptyData: [] as Array<Record<string, unknown>>,
  hasNextPage: false,
  isFetchNextPageError: false,
  loadMore: vi.fn(),
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
const manyGroupBuys = Array.from({ length: 12 }, (_, index) => ({
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
vi.mock("../features/feed/queries", async importOriginal => ({
  ...await importOriginal<typeof import("../features/feed/queries")>(),
  useGroupBuyFeed: () => ({ ...queryResultMock, items: queryResultMock.data ?? queryResultMock.emptyData }),
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
      playbackLifecycleMock.isAppActive,
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
    act(() => setMediaMuted(false));
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
    queryResultMock.hasNextPage = false;
    queryResultMock.isFetchNextPageError = false;
    queryResultMock.loadMore.mockClear();
    pagerViewMock.mounts = 0;
    pagerViewMock.setPageWithoutAnimation.mockClear();
    adsMock.enabled = false;
    adsMock.isReady = false;
    adsMock.nativeUnitIds.reels = null;
  });

  const renderAdSwipe = (initialPosition: number, adPosition = 5) => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    try {
      act(() => {
        renderer = TestRenderer.create(<ReelsScreen />);
      });
    } finally {
      randomSpy.mockRestore();
    }

    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");
    const selectPage = (position: number) => {
      act(() => {
        findPager().props.onPageSelected({ nativeEvent: { position } });
      });
    };
    const contentAt = (position: number): string | undefined => {
      const page = findPager().children[
        position
      ] as TestRenderer.ReactTestInstance;
      return page.findAll((node) => String(node.type) === "ProductReelPage")[0]
        ?.props.groupBuy.id;
    };
    // Capture the adjacent products with an idle, still-loading ad selected.
    // The actual gesture may defer playback/render selection until it settles.
    selectPage(adPosition);
    const adjacentContent = new Map([
      [adPosition - 1, contentAt(adPosition - 1)],
      [adPosition + 1, contentAt(adPosition + 1)],
    ]);
    selectPage(initialPosition);
    pagerViewMock.setPageWithoutAnimation.mockClear();

    return {
      selectPage,
      scrollState: (pageScrollState: "dragging" | "settling" | "idle") => {
        act(() => {
          findPager().props.onPageScrollStateChanged?.({
            nativeEvent: { pageScrollState },
          });
        });
      },
      scrollPage: (position: number, offset: number) => {
        act(() => {
          findPager().props.onPageScroll?.({
            nativeEvent: { position, offset },
          });
        });
      },
      failAd: (sequence = 2) => {
        act(() => {
          renderer!.root
            .findByProps({ testID: `reels-native-ad-${sequence}` })
            .props.onLoadStateChange("unavailable");
        });
      },
      contentAt,
      adjacentContentAt: (position: number) => adjacentContent.get(position),
      activeContent: (): string[] =>
        renderer!.root
          .findAll(
            (node) =>
              String(node.type) === "ProductReelPage" && node.props.isActive,
          )
          .map((node) => node.props.groupBuy.id),
      unmount: () => act(() => renderer!.unmount()),
    };
  };

  it("keeps a native ad above the Reels tab bar chrome", () => {
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();

    act(() => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position: 1 } });
    });

    const ad = renderer!.root.findByProps({ testID: "reels-native-ad-1" });
    expect(ad.props.reelBottomInset).toBe(40);

    act(() => {
      renderer!.unmount();
    });
  });

  it("includes an ad in a short feed even when the random first gap is maximal", () => {
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.999999);
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    try {
      act(() => {
        renderer = TestRenderer.create(<ReelsScreen />);
      });
      act(() =>
        renderer!.root
          .find((node) => String(node.type) === "PagerView")
          .props.onPageSelected({ nativeEvent: { position: 1 } }),
      );
      expect(
        renderer!.root.findAllByProps({ testID: "reels-native-ad-1" }).length,
      ).toBeGreaterThan(0);
    } finally {
      if (renderer) act(() => renderer!.unmount());
      randomSpy.mockRestore();
    }
  });

  it("keeps the pager stable while the native ad SDK becomes ready", () => {
    adsMock.enabled = true;
    adsMock.isReady = false;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    expect(pagerViewMock.mounts).toBe(1);
    act(() => {
      adsMock.isReady = true;
      renderer!.update(<ReelsScreen />);
    });

    expect(pagerViewMock.mounts).toBe(1);
    randomSpy.mockRestore();
    act(() => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position: 1 } });
    });
    expect(
      renderer!.root.findByProps({ testID: "reels-native-ad-1" }),
    ).toBeTruthy();

    act(() => renderer!.unmount());
  });

  it("skips an unavailable ad without remounting the pager or losing later ads", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();

    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");

    act(() => {
      findPager().props.onPageSelected({ nativeEvent: { position: 2 } });
    });
    const firstAd = renderer!.root.findByProps({
      testID: "reels-native-ad-1",
    });
    expect(firstAd.props.visible).toBe(true);
    expect(firstAd.props.onLoadStateChange).toBeTypeOf("function");

    act(() => {
      firstAd.props.onLoadStateChange("unavailable");
    });
    expect(pagerViewMock.mounts).toBe(1);
    expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(3);
    expect(
      renderer!.root.findAll(
        (node) =>
          String(node.type) === "ProductReelPage" && node.props.isActive,
      ),
    ).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({
        children: "이번 광고를 불러오지 못했어요",
      }),
    ).toHaveLength(0);

    act(() => {
      findPager().props.onPageSelected({ nativeEvent: { position: 3 } });
    });
    act(() => {
      findPager().props.onPageScrollStateChanged({
        nativeEvent: { pageScrollState: "dragging" },
      });
    });
    act(() => {
      findPager().props.onPageScrollStateChanged({
        nativeEvent: { pageScrollState: "settling" },
      });
    });
    act(() => {
      findPager().props.onPageSelected({ nativeEvent: { position: 5 } });
    });
    act(() => {
      findPager().props.onPageScrollStateChanged({
        nativeEvent: { pageScrollState: "idle" },
      });
    });
    expect(
      renderer!.root.findByProps({ testID: "reels-native-ad-2" }).props.visible,
    ).toBe(true);

    act(() => renderer!.unmount());
  });

  it("preloads the next ad before it enters the product render window", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();

    const ad = renderer!.root.findByProps({ testID: "reels-native-ad-1" });
    expect(ad.props.visible).toBe(false);
    expect(ad.props.loadEnabled).toBe(true);
    expect(
      renderer!.root.findAll((node) => String(node.type) === "NativeAdCard"),
    ).toHaveLength(1);

    act(() => ad.props.onLoadStateChange("loaded"));
    act(() => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position: 6 } });
    });
    expect(
      renderer!.root.findByProps({ testID: "reels-native-ad-1" }).props.visible,
    ).toBe(true);
    expect(
      renderer!.root.findAllByProps({ children: "광고를 불러오는 중이에요" }),
    ).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it("waits until a failed preloaded ad is selected before skipping it", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();

    const ad = renderer!.root.findByProps({ testID: "reels-native-ad-1" });
    act(() => ad.props.onLoadStateChange("unavailable"));
    expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
    act(() => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position: 2 } });
    });
    expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(3);
    expect(pagerViewMock.mounts).toBe(1);
    act(() => renderer!.unmount());
  });

  it("skips a failed ad in the direction of a backward swipe", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();
    const selectPage = (position: number) => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position } });
    };
    act(() => selectPage(3));
    act(() => selectPage(2));
    act(() => {
      renderer!.root
        .findByProps({ testID: "reels-native-ad-1" })
        .props.onLoadStateChange("unavailable");
    });
    // Index 1 recenters the bounded window; the selected organic page is 8.
    expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(8);
    expect(pagerViewMock.mounts).toBe(1);
    expect(
      renderer!.root.findAll(
        (node) =>
          String(node.type) === "ProductReelPage" && node.props.isActive,
      ),
    ).toHaveLength(1);
    act(() => renderer!.unmount());
  });

  it.each([
    {
      direction: "forward",
      initialPosition: 4,
      destination: 6,
      state: "dragging",
    },
    {
      direction: "forward",
      initialPosition: 4,
      destination: 6,
      state: "settling",
    },
    {
      direction: "backward",
      initialPosition: 6,
      destination: 4,
      state: "dragging",
    },
    {
      direction: "backward",
      initialPosition: 6,
      destination: 4,
      state: "settling",
    },
  ] as const)(
    "finishes a $direction swipe before skipping an ad that fails while $state",
    ({ initialPosition, destination, state }) => {
      const swipe = renderAdSwipe(initialPosition);
      try {
        swipe.scrollState("dragging");
        if (state === "settling") swipe.scrollState("settling");
        swipe.selectPage(5);
        const expectedContent = swipe.adjacentContentAt(destination);
        expect(expectedContent).toBeDefined();

        swipe.failAd();
        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
        swipe.scrollState("settling");
        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();

        swipe.scrollState("idle");
        expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(
          destination,
        );
        expect(swipe.activeContent()).toEqual([expectedContent]);
        swipe.selectPage(destination);
        expect(swipe.activeContent()).toEqual([expectedContent]);
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        swipe.unmount();
      }
    },
  );

  it.each([
    {
      direction: "forward",
      initialPosition: 4,
      adPosition: 5,
      destination: 6,
      sequence: 2,
    },
    {
      direction: "backward",
      initialPosition: 6,
      adPosition: 5,
      destination: 4,
      sequence: 2,
    },
    {
      direction: "backward across the window edge",
      initialPosition: 3,
      adPosition: 2,
      destination: 1,
      sequence: 1,
    },
  ])(
    "keeps the $direction destination when old ad selections arrive before the skip acknowledgement",
    ({ initialPosition, adPosition, destination, sequence }) => {
      const swipe = renderAdSwipe(initialPosition, adPosition);
      try {
        swipe.scrollState("dragging");
        swipe.scrollState("settling");
        swipe.selectPage(adPosition);
        const expectedContent = swipe.adjacentContentAt(destination);
        expect(expectedContent).toBeDefined();
        swipe.failAd(sequence);
        swipe.scrollState("idle");

        const commands = pagerViewMock.setPageWithoutAnimation.mock.calls;
        const targetPosition = commands[commands.length - 1]?.[0] as number;
        expect(targetPosition).toBeTypeOf("number");
        expect(swipe.contentAt(targetPosition)).toBe(expectedContent);
        expect(swipe.activeContent()).toEqual([expectedContent]);
        const commandCount = commands.length;

        // Android can deliver queued selections from the swipe after JS has
        // issued setPageWithoutAnimation, before it acknowledges the new page.
        for (let index = 0; index < 2; index += 1) {
          swipe.selectPage(adPosition);
          expect(swipe.activeContent()).toEqual([expectedContent]);
          expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(
            commandCount,
          );
        }
        swipe.selectPage(targetPosition);
        expect(swipe.activeContent()).toEqual([expectedContent]);
        expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(
          commandCount,
        );
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        swipe.unmount();
      }
    },
  );

  it.each([4, 6])(
    "keeps product page %i when a failed-ad swipe reverses before becoming idle",
    (initialPosition) => {
      const swipe = renderAdSwipe(initialPosition);
      try {
        const originalContent = swipe.contentAt(initialPosition);
        expect(originalContent).toBeDefined();
        swipe.scrollState("dragging");
        swipe.selectPage(5);
        swipe.failAd();

        // The finger returns to its starting page before native scrolling
        // finishes. A pending ad skip must follow the final selection.
        swipe.selectPage(initialPosition);
        swipe.scrollState("settling");
        swipe.scrollState("idle");
        expect(swipe.activeContent()).toEqual([originalContent]);
        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        swipe.unmount();
      }
    },
  );

  it("keeps the current product when a swipe toward a failed preloaded ad is cancelled", () => {
    const swipe = renderAdSwipe(4);
    try {
      const originalContent = swipe.contentAt(4);
      expect(originalContent).toBeDefined();
      swipe.failAd();
      swipe.scrollState("dragging");
      swipe.scrollPage(4, 0.8);
      swipe.scrollPage(4, 0);
      swipe.scrollState("settling");
      swipe.selectPage(4);
      swipe.scrollState("idle");

      expect(swipe.activeContent()).toEqual([originalContent]);
      expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
      expect(pagerViewMock.mounts).toBe(1);
    } finally {
      swipe.unmount();
    }
  });

  it("accepts a new product swipe before the previous ad skip is acknowledged", () => {
    const swipe = renderAdSwipe(4);
    try {
      swipe.scrollState("dragging");
      swipe.scrollState("settling");
      swipe.selectPage(5);
      swipe.failAd();
      swipe.scrollState("idle");
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(6);
      const expectedContent = swipe.contentAt(7);
      expect(expectedContent).toBeDefined();

      // No onPageSelected(6) acknowledgement: a real new gesture must still
      // advance rather than being swallowed by the old programmatic guard.
      swipe.scrollState("dragging");
      swipe.scrollState("settling");
      swipe.selectPage(7);
      swipe.scrollState("idle");
      expect(swipe.activeContent()).toEqual([expectedContent]);
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(1);
      expect(pagerViewMock.mounts).toBe(1);
    } finally {
      swipe.unmount();
    }
  });

  it.each(["product", "ad"])("keeps the active %s mounted when the next page arrives", (kind) => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReelsScreen />); });
    randomSpy.mockRestore();
    const pager = () => renderer!.root.find(node => String(node.type) === "PagerView");
    const activeNode = () => kind === "ad"
      ? renderer!.root.findByProps({ testID: "reels-native-ad-1" })
      : renderer!.root.find(node => String(node.type) === "ProductReelPage" && node.props.isActive);
    act(() => pager().props.onPageSelected({ nativeEvent: { position: kind === "ad" ? 2 : 4 } }));
    const previous = activeNode();
    queryResultMock.data = [...manyGroupBuys, ...manyGroupBuys.map(item => ({ ...item, id: `${item.id}-page-2` }))];
    act(() => renderer!.update(<ReelsScreen />));
    expect(activeNode()).toBe(previous);
    if (kind === "ad") expect(activeNode().props.visible).toBe(true);
    expect(pagerViewMock.mounts).toBe(1);
    act(() => renderer!.unmount());
  });

  it.each(["backward wrap", "second lap"])("retains the player instance when appending after %s", (scenario) => {
    queryResultMock.data = manyGroupBuys;
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReelsScreen />); });
    const pager = () => renderer!.root.find(node => String(node.type) === "PagerView");
    const active = () => renderer!.root.find(node => String(node.type) === "ProductReelPage" && node.props.isActive);
    const step = (direction: number) => {
      act(() => pager().props.onPageSelected({ nativeEvent: { position: pager().props.initialPage + direction } }));
      act(() => pager().props.onPageSelected({ nativeEvent: { position: pager().props.initialPage } }));
    };
    if (scenario === "backward wrap") { step(1); step(-1); step(-1); }
    else for (let index = 0; index < 14; index += 1) step(1);
    const previous = active();
    queryResultMock.data = [...manyGroupBuys, ...manyGroupBuys.map(item => ({ ...item, id: `${item.id}-page-2` }))];
    act(() => renderer!.update(<ReelsScreen />));
    expect(active() === previous).toBe(true);
    expect(pagerViewMock.mounts).toBe(1);
    act(() => renderer!.unmount());
  });

  it("requests the next page near the end and does not retry a failed page automatically", () => {
    queryResultMock.data = manyGroupBuys;
    queryResultMock.hasNextPage = true;
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReelsScreen />); });
    expect(queryResultMock.loadMore).not.toHaveBeenCalled();
    act(() => renderer!.root.find(node => String(node.type) === "PagerView").props.onPageSelected({ nativeEvent: { position: 8 } }));
    expect(queryResultMock.loadMore).toHaveBeenCalledTimes(1);
    queryResultMock.isFetchNextPageError = true;
    act(() => renderer!.update(<ReelsScreen />));
    expect(queryResultMock.loadMore).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });

  it("keeps the selected ad request alive across the store activity", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();
    act(() => {
      renderer!.root
        .find((node) => String(node.type) === "PagerView")
        .props.onPageSelected({ nativeEvent: { position: 2 } });
    });
    const findAd = () =>
      renderer!.root.findByProps({ testID: "reels-native-ad-1" });
    const selectedAd = findAd();
    act(() => selectedAd.props.onLoadStateChange("loaded"));

    for (const isAppActive of [false, true]) {
      playbackLifecycleMock.isAppActive = isAppActive;
      playbackLifecycleMock.isAppFocused = isAppActive;
      act(() => renderer!.update(<ReelsScreen />));
      expect(findAd()).toBe(selectedAd);
      expect(findAd().props.loadEnabled).toBe(true);
      expect(findAd().props.visible).toBe(isAppActive);
    }
    expect(pagerViewMock.mounts).toBe(1);
    act(() => renderer!.unmount());
  });

  it("does not request or show Reels ads after leaving the tab", () => {
    queryResultMock.data = manyGroupBuys;
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    randomSpy.mockRestore();
    playbackLifecycleMock.isScreenFocused = false;
    act(() => renderer!.update(<ReelsScreen />));
    const ads = renderer!.root.findAll(
      (node) => String(node.type) === "NativeAdCard",
    );
    expect(ads.length).toBeGreaterThan(0);
    expect(ads.every((ad) => !ad.props.loadEnabled && !ad.props.visible)).toBe(
      true,
    );
    act(() => renderer!.unmount());
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

  it("removes stale products and ad slots when a refreshed feed becomes empty", () => {
    adsMock.enabled = true;
    adsMock.isReady = true;
    adsMock.nativeUnitIds.reels = "reels-native-unit";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    try {
      act(() => {
        renderer = TestRenderer.create(<ReelsScreen />);
      });
      act(() => {
        renderer!.root
          .find((node) => String(node.type) === "PagerView")
          .props.onPageSelected({ nativeEvent: { position: 1 } });
      });
      expect(
        renderer!.root.findAll(
          (node) => String(node.type) === "ProductReelPage",
        ).length,
      ).toBeGreaterThan(0);
      expect(
        renderer!.root.findAll((node) => String(node.type) === "NativeAdCard")
          .length,
      ).toBeGreaterThan(0);

      act(() => {
        queryResultMock.data = [];
        renderer!.update(<ReelsScreen />);
      });

      expect(
        renderer!.root.findAll(
          (node) =>
            String(node.type) === "ProductReelPage" ||
            String(node.type) === "NativeAdCard" ||
            String(node.type) === "ReelVideoPreloader" ||
            String(node.type) === "PagerView",
        ),
      ).toHaveLength(0);
      expect(
        renderer!.root.findAllByProps({
          children: "표시할 릴스 영상이 없어요",
        }).length,
      ).toBeGreaterThan(0);

      act(() => {
        queryResultMock.data = [
          { ...groupBuys[0], id: "new-reel", productName: "새 공구" },
        ];
        renderer!.update(<ReelsScreen />);
      });
      expect(
        renderer!.root
          .findAll((node) => String(node.type) === "ProductReelPage")
          .filter((node) => node.props.isActive)
          .map((node) => node.props.groupBuy.id),
      ).toEqual(["new-reel"]);
    } finally {
      if (renderer) act(() => renderer!.unmount());
      randomSpy.mockRestore();
    }
  });

  it("keeps playing for Android blur, pauses for background, and releases the preloader after leaving Reels", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const renderScreen = () => <ReelsScreen />;

    act(() => {
      renderer = TestRenderer.create(renderScreen());
    });

    const findPreloaders = () =>
      renderer!.root.findAll(
        (node) => String(node.type) === "ReelVideoPreloader",
      );
    const findActivePage = () =>
      renderer!.root.findAll(
        (node) =>
          String(node.type) === "ProductReelPage" && node.props.isActive,
      )[0];

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);
    expect(findActivePage()?.props.playbackAllowed).toBe(true);

    playbackLifecycleMock.isAppFocused = false;
    act(() => {
      renderer!.update(renderScreen());
    });

    expect(findPreloaders()).toHaveLength(1);
    expect(findPreloaders()[0]?.props.enabled).toBe(true);
    expect(findActivePage()?.props.playbackAllowed).toBe(true);

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
    expect(findActivePage()?.props.playbackAllowed).toBe(false);

    playbackLifecycleMock.isScreenFocused = false;
    act(() => {
      renderer!.update(renderScreen());
    });

    expect(findPreloaders()).toHaveLength(0);
    expect(findActivePage()).toBeUndefined();

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

  it("hides Reels tab chrome while the comments sheet is open", () => {
    const visibilityMock = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ReelsScreen onSheetVisibilityChange={visibilityMock} />,
      );
    });

    const findPages = () =>
      renderer!.root.findAll((node) => String(node.type) === "ProductReelPage");
    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");
    const activePage = findPages().find((node) => node.props.isActive);
    expect(activePage).toBeDefined();
    visibilityMock.mockClear();

    act(() => {
      activePage!.props.onCommentsSheetStateChange?.(true);
    });

    expect(visibilityMock).toHaveBeenLastCalledWith(true);
    expect(findPager().props.scrollEnabled).toBe(false);

    act(() => {
      activePage!.props.onCommentsSheetStateChange?.(false);
    });

    expect(visibilityMock).toHaveBeenLastCalledWith(false);
    expect(findPager().props.scrollEnabled).toBe(true);

    act(() => {
      renderer!.unmount();
    });
  });

  it.each(["initial idle", "cancelled swipe"])(
    "keeps the original edge page unchanged after %s without a new selection",
    (scenario) => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(<ReelsScreen />);
      });
      const findPager = () =>
        renderer!.root.find((node) => String(node.type) === "PagerView");
      const findActivePage = () =>
        renderer!.root.find(
          (node) =>
            String(node.type) === "ProductReelPage" && node.props.isActive,
        );
      const pageKeys = () =>
        findPager().props.children.map((page: React.ReactElement) => page.key);
      const originalPages = pageKeys();
      const originalContent = findActivePage().props.groupBuy.id;

      try {
        if (scenario === "cancelled swipe") {
          act(() => {
            findPager().props.onPageScrollStateChanged({
              nativeEvent: { pageScrollState: "dragging" },
            });
          });
          act(() => {
            findPager().props.onPageScroll?.({
              nativeEvent: { position: 0, offset: 0.4 },
            });
          });
          act(() => {
            findPager().props.onPageScrollStateChanged({
              nativeEvent: { pageScrollState: "settling" },
            });
          });
        }
        act(() => {
          findPager().props.onPageScrollStateChanged({
            nativeEvent: { pageScrollState: "idle" },
          });
        });

        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
        expect(pageKeys()).toEqual(originalPages);
        expect(findActivePage().props.groupBuy.id).toBe(originalContent);
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        act(() => renderer!.unmount());
      }
    },
  );

  it("waits for a late final selection before recentering an edge swipe that is already idle", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });
    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");
    const findActivePage = () =>
      renderer!.root.find(
        (node) =>
          String(node.type) === "ProductReelPage" && node.props.isActive,
      );
    const originalPages = findPager().props.children.map(
      (page: React.ReactElement) => page.key,
    );
    const originalContent = findActivePage().props.groupBuy.id;
    const nextPage = findPager().children[1] as TestRenderer.ReactTestInstance;
    const expectedContent = nextPage.find(
      (node) => String(node.type) === "ProductReelPage",
    ).props.groupBuy.id;

    try {
      for (const pageScrollState of ["dragging", "settling", "idle"]) {
        act(() => {
          findPager().props.onPageScrollStateChanged({
            nativeEvent: { pageScrollState },
          });
        });
      }
      expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
      expect(
        findPager().props.children.map((page: React.ReactElement) => page.key),
      ).toEqual(originalPages);
      expect(findActivePage().props.groupBuy.id).toBe(originalContent);

      act(() => {
        findPager().props.onPageSelected({ nativeEvent: { position: 1 } });
      });
      expect(findActivePage().props.groupBuy.id).toBe(expectedContent);
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(1);
      const commands = pagerViewMock.setPageWithoutAnimation.mock.calls;
      const targetPosition = commands[0]?.[0] as number;
      const targetPage = findPager().children[
        targetPosition
      ] as TestRenderer.ReactTestInstance;
      expect(
        targetPage.find((node) => String(node.type) === "ProductReelPage").props
          .groupBuy.id,
      ).toBe(expectedContent);
      act(() => {
        findPager().props.onPageSelected({
          nativeEvent: { position: targetPosition },
        });
      });
      expect(findActivePage().props.groupBuy.id).toBe(expectedContent);
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(1);
      expect(pagerViewMock.mounts).toBe(1);
    } finally {
      act(() => renderer!.unmount());
    }
  });

  it.each(["no new selection", "return to start", "last page"])(
    "finishes an interrupted edge transition after the next gesture has %s",
    (scenario) => {
      queryResultMock.data = manyGroupBuys;
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(<ReelsScreen />);
      });
      const findPager = () =>
        renderer!.root.find((node) => String(node.type) === "PagerView");
      const select = (position: number) => {
        act(() => {
          findPager().props.onPageSelected({ nativeEvent: { position } });
        });
      };
      const state = (pageScrollState: string) => {
        act(() => {
          findPager().props.onPageScrollStateChanged({
            nativeEvent: { pageScrollState },
          });
        });
      };
      const activeContent = () =>
        renderer!.root.find(
          (node) =>
            String(node.type) === "ProductReelPage" && node.props.isActive,
        ).props.groupBuy.id;
      try {
        select(8);
        const initialPages = findPager().props.children.map(
          (page: React.ReactElement) => page.key,
        );
        state("dragging");
        state("settling");
        select(9);
        // A new finger interrupts settling before the previous idle callback.
        state("dragging");
        if (scenario === "return to start") {
          select(10);
          select(9);
        } else if (scenario === "last page") {
          state("settling");
          select(10);
          state("dragging");
        }
        state("settling");
        const selectedContent = activeContent();
        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
        expect(
          findPager().props.children.map(
            (page: React.ReactElement) => page.key,
          ),
        ).toEqual(initialPages);
        state("idle");
        expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(1);
        expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenLastCalledWith(
          2,
        );
        expect(activeContent()).toBe(selectedContent);
        select(2);
        state("dragging");
        state("settling");
        select(3);
        state("idle");
        expect(activeContent()).not.toBe(selectedContent);
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        act(() => renderer!.unmount());
      }
    },
  );

  it.each(["forward", "backward"])(
    "skips an unavailable ad at the physical window end %s",
    (direction) => {
      queryResultMock.data = manyGroupBuys;
      adsMock.enabled = true;
      adsMock.isReady = true;
      adsMock.nativeUnitIds.reels = "reels-native-unit";
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      let renderer: TestRenderer.ReactTestRenderer;
      try {
        act(() => {
          renderer = TestRenderer.create(<ReelsScreen />);
        });
      } finally {
        randomSpy.mockRestore();
      }
      const findPager = () =>
        renderer!.root.find((node) => String(node.type) === "PagerView");
      const select = (position: number) => {
        act(() => {
          findPager().props.onPageSelected({ nativeEvent: { position } });
        });
      };
      const state = (pageScrollState: string) => {
        act(() => {
          findPager().props.onPageScrollStateChanged({
            nativeEvent: { pageScrollState },
          });
        });
      };
      const contentAt = (position: number) =>
        (findPager().children[position] as TestRenderer.ReactTestInstance).find(
          (node) => String(node.type) === "ProductReelPage",
        ).props.groupBuy.id;
      try {
        const backwardContent = contentAt(1);
        select(10);
        select(2);
        select(3);
        const forwardContent = contentAt(4);
        select(2);
        select(1);
        select(8);
        if (direction === "backward") {
          select(10);
          select(2);
          select(1);
          select(8);
        }
        pagerViewMock.setPageWithoutAnimation.mockClear();
        state("dragging");
        state("settling");
        select(direction === "forward" ? 10 : 0);
        act(() => {
          renderer!.root
            .findByProps({
              testID: `reels-native-ad-${direction === "forward" ? 4 : 1}`,
            })
            .props.onLoadStateChange("unavailable");
        });
        expect(pagerViewMock.setPageWithoutAnimation).not.toHaveBeenCalled();
        state("idle");
        const expected =
          direction === "forward" ? forwardContent : backwardContent;
        const activePage = renderer!.root.find(
          (node) =>
            String(node.type) === "ProductReelPage" && node.props.isActive,
        );
        expect(activePage.props.groupBuy.id).toBe(expected);
        expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(1);
        const target = pagerViewMock.setPageWithoutAnimation.mock.calls[0][0];
        expect(contentAt(target)).toBe(expected);
        select(target);
        expect(pagerViewMock.mounts).toBe(1);
      } finally {
        act(() => renderer!.unmount());
      }
    },
  );

  it("keeps the pager page window bounded after repeated forward swipes", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ReelsScreen />);
    });

    const findPager = () =>
      renderer!.root.find((node) => String(node.type) === "PagerView");

    for (let index = 0; index < 100; index += 1) {
      const previousPages = findPager().props.children.map(
        (page: React.ReactElement) => page.key,
      );
      act(() => {
        findPager().props.onPageScrollStateChanged({
          nativeEvent: { pageScrollState: "dragging" },
        });
      });
      act(() => {
        findPager().props.onPageScrollStateChanged({
          nativeEvent: { pageScrollState: "settling" },
        });
      });
      act(() => {
        findPager().props.onPageSelected({
          nativeEvent: {
            position: REEL_PAGE_WINDOW_SIZE - REEL_PAGE_WINDOW_EDGE,
          },
        });
      });
      expect(
        findPager().props.children.map((page: React.ReactElement) => page.key),
      ).toEqual(previousPages);
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(
        index,
      );
      const selectedContent = renderer!.root.find(
        (node) =>
          String(node.type) === "ProductReelPage" && node.props.isActive,
      ).props.groupBuy.id;
      act(() => {
        findPager().props.onPageScrollStateChanged({
          nativeEvent: { pageScrollState: "idle" },
        });
      });
      expect(
        renderer!.root.find(
          (node) =>
            String(node.type) === "ProductReelPage" && node.props.isActive,
        ).props.groupBuy.id,
      ).toBe(selectedContent);
      expect(pagerViewMock.setPageWithoutAnimation).toHaveBeenCalledTimes(
        index + 1,
      );
      // The next real dragging event must recover if native acknowledgement
      // of this recenter is delayed or omitted.

      const children = findPager().props.children as unknown[];
      expect(children).toHaveLength(REEL_PAGE_WINDOW_SIZE);
      expect(findPager().props.initialPage).toBeGreaterThanOrEqual(0);
      expect(findPager().props.initialPage).toBeLessThan(REEL_PAGE_WINDOW_SIZE);
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
