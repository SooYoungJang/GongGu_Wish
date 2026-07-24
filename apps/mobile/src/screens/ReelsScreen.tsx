import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import PagerView from "react-native-pager-view";

import { fetchGroupBuys } from "../api";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { NativeAdCard } from "../components/ads/NativeAdCard";
import type { NativeAdLoadStatus } from "../components/ads/NativeAdCard.types";
import { logDeepView } from "../api";
import { useAds } from "../ads/AdsContext";
import { useRecentViews } from "../hooks/useLocalDeals";
import { usePlaybackLifecycle } from "../hooks/usePlaybackLifecycle";
import { useTabReselect } from "../hooks/useTabReselect";
import { useTheme } from "../context/ThemeContext";
import type { GroupBuy, MainTabParamList } from "../types";
import { getRandomReelIndex } from "./reelNavigation";
import {
  ProductReelPage,
  ReelVideoPreloader,
  hasPlayableVideoMedia,
  makeStyles,
} from "./DetailScreen";
import {
  createReelWindow,
  moveReelWindow,
  type ReelWindow,
} from "./reelWindow";
import {
  DEEP_VIEW_THRESHOLD_MS,
  isPlaybackEligible,
} from "./playbackEligibility";
import {
  insertReelsAdSlots,
  isReelsContentItem,
  type ReelsFeedItem,
} from "./reelsAdPlacement";

const REELS_TAB_BAR_OVERLAY_OFFSET = 40;
const REEL_PAGE_RENDER_RADIUS = 1;
const NOOP = () => {};

function shouldRenderReelPage(index: number, activeIndex: number) {
  return Math.abs(index - activeIndex) <= REEL_PAGE_RENDER_RADIUS;
}

// Fisher-Yates shuffle so each visit to the Reels tab shows feeds in a
// different random order, like shuffling a playlist.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ReelsScreen({
  onSheetVisibilityChange,
}: {
  onSheetVisibilityChange?: (visible: boolean) => void;
}) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const {
    enabled: adsEnabled,
    isReady: adsReady,
    nativeUnitIds,
  } = useAds();
  const pagerRef = useRef<PagerView>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [reelDirection, setReelDirection] = useState<1 | -1>(1);
  const [reelWindow, setReelWindow] = useState<
    ReelWindow<ReelsFeedItem<GroupBuy>>
  >(() => createReelWindow([]));
  const { activeIndex, items: reelItems } = reelWindow;
  const [summarySheetGate, setSummarySheetGate] = useState({
    isOpen: false,
    canSwipeReel: true,
  });
  const {
    isScreenFocused: isTabFocused,
    isAppActive,
    isAppFocused,
    isPlaybackActive,
  } = usePlaybackLifecycle();
  const [isActivePlayerPlaying, setActivePlayerPlaying] = useState(false);
  const [isReelsMuted, setReelsMuted] = useState(false);
  const [reelsAdsUnavailable, setReelsAdsUnavailable] = useState(false);
  const { recordView } = useRecentViews();

  useEffect(() => {
    onSheetVisibilityChange?.(summarySheetGate.isOpen);
  }, [onSheetVisibilityChange, summarySheetGate.isOpen]);

  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["group-buys"],
    queryFn: fetchGroupBuys,
  });

  // Base shuffled batch, refreshed each time data arrives.
  const shuffledGroupBuys = useMemo<GroupBuy[]>(() => {
    return shuffle(data ?? []);
  }, [data]);
  const canShowReelsAds =
    adsEnabled &&
    adsReady &&
    Boolean(nativeUnitIds.reels) &&
    !reelsAdsUnavailable;
  const baseBatch = useMemo(
    () =>
      insertReelsAdSlots(shuffledGroupBuys, {
        enabled: canShowReelsAds,
      }),
    [canShowReelsAds, shuffledGroupBuys],
  );
  const reelPagerKey = useMemo(
    () => baseBatch.map((item) => item.key).join("|"),
    [baseBatch],
  );

  useEffect(() => {
    if (baseBatch.length === 0) return;
    setReelWindow((current) => {
      const activeItem = current.items[current.activeIndex];
      const nearbyContent = activeItem
        ? [
            activeItem,
            ...current.items.slice(current.activeIndex + 1),
            ...current.items.slice(0, current.activeIndex),
          ].find(isReelsContentItem)
        : undefined;
      const preservedIndex = nearbyContent
        ? baseBatch.findIndex(
            (item) =>
              isReelsContentItem(item) &&
              item.content.id === nearbyContent.content.id,
          )
        : -1;
      return createReelWindow(baseBatch, Math.max(0, preservedIndex));
    });
    setReelDirection(1);
  }, [baseBatch]);

  const handleReelsTabReselect = useCallback(() => {
    if (reelItems.length === 0) return;

    const contentIndexes = reelItems.flatMap((item, index) =>
      isReelsContentItem(item) ? [index] : [],
    );
    if (contentIndexes.length === 0) return;
    const currentContentPosition = Math.max(
      0,
      contentIndexes.indexOf(activeIndex),
    );
    const nextContentPosition = getRandomReelIndex(
      contentIndexes.length,
      currentContentPosition,
    );
    const nextIndex = contentIndexes[nextContentPosition];
    setReelDirection(nextIndex >= activeIndex ? 1 : -1);
    const nextWindow = moveReelWindow(reelWindow, baseBatch, nextIndex);
    setReelWindow(nextWindow);
    setReplayKey((key) => key + 1);
    if (nextWindow.sourceStart === reelWindow.sourceStart) {
      pagerRef.current?.setPageWithoutAnimation?.(nextWindow.activeIndex);
    }
  }, [activeIndex, baseBatch, reelItems.length, reelWindow]);

  useTabReselect(navigation, handleReelsTabReselect);

  const activeFeedItem = reelItems[activeIndex];
  const activeReelItem =
    activeFeedItem && isReelsContentItem(activeFeedItem)
      ? activeFeedItem.content
      : undefined;
  const hasPlayableActiveMedia = hasPlayableVideoMedia(activeReelItem);
  const activeReelItemIdRef = useRef<string | undefined>(activeReelItem?.id);
  useLayoutEffect(() => {
    activeReelItemIdRef.current = activeReelItem?.id;
  }, [activeReelItem?.id]);
  const handlePlaybackStateChange = useCallback(
    (itemId: string, isPlaying: boolean) => {
      if (itemId !== activeReelItemIdRef.current) return;
      setActivePlayerPlaying((current) =>
        current === isPlaying ? current : isPlaying,
      );
    },
    [],
  );
  useEffect(() => {
    setActivePlayerPlaying(false);
  }, [activeReelItem?.id, isPlaybackActive]);
  const previousReelWindowStartRef = useRef(reelWindow.sourceStart);
  useLayoutEffect(() => {
    const previousSourceStart = previousReelWindowStartRef.current;
    previousReelWindowStartRef.current = reelWindow.sourceStart;
    if (previousSourceStart === reelWindow.sourceStart) return;
    pagerRef.current?.setPageWithoutAnimation?.(reelWindow.activeIndex);
  }, [reelWindow.activeIndex, reelWindow.sourceStart]);
  const lastRecordedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const item = isPlaybackActive ? activeReelItem : undefined;
    if (item && item.id !== lastRecordedIdRef.current) {
      lastRecordedIdRef.current = item.id;
      recordView(item);
    }
    if (!isPlaybackActive) lastRecordedIdRef.current = null;
  }, [isPlaybackActive, activeReelItem, recordView]);

  // ── Deep view tracking: count a view only after 10s of continuous watch ──
  const deepViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackEligibleRef = useRef(false);
  useEffect(() => {
    if (deepViewTimerRef.current) {
      clearTimeout(deepViewTimerRef.current);
      deepViewTimerRef.current = null;
    }
    const playbackEligible = isPlaybackEligible({
      screenFocused: isTabFocused,
      appActive: isAppActive && isAppFocused,
      overlayOpen: summarySheetGate.isOpen,
      playerPlaying: isActivePlayerPlaying,
      hasPlayableMedia: hasPlayableActiveMedia,
    });
    playbackEligibleRef.current = playbackEligible;
    if (playbackEligible && activeReelItem) {
      const id = activeReelItem.id;
      deepViewTimerRef.current = setTimeout(() => {
        if (!playbackEligibleRef.current) return;
        void Promise.resolve(logDeepView(id)).catch(() => undefined);
      }, DEEP_VIEW_THRESHOLD_MS);
    }
    return () => {
      if (deepViewTimerRef.current) {
        clearTimeout(deepViewTimerRef.current);
        deepViewTimerRef.current = null;
      }
    };
  }, [
    activeReelItem,
    hasPlayableActiveMedia,
    isActivePlayerPlaying,
    isAppActive,
    isAppFocused,
    isTabFocused,
    summarySheetGate.isOpen,
  ]);

  const handleSummarySheetStateChange = useCallback(
    (isOpen: boolean, canSwipeReel: boolean) => {
      setSummarySheetGate((current) =>
        current.isOpen === isOpen && current.canSwipeReel === canSwipeReel
          ? current
          : { isOpen, canSwipeReel },
      );
    },
    [],
  );

  const renderReelItem = useCallback(
    (item: GroupBuy, index: number) => (
      <ProductReelPage
        key={item.id}
        groupBuy={item}
        isActive={isPlaybackActive && index === activeIndex}
        playbackAllowed={
          isPlaybackActive && index === activeIndex
        }
        replayKey={replayKey}
        shouldPreloadVideo={Math.abs(index - activeIndex) <= 1}
        bottomChromeOffset={REELS_TAB_BAR_OVERLAY_OFFSET}
        pageHeight={screenHeight}
        mediaWidth={screenWidth}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={NOOP}
        showBackButton={false}
        muted={isReelsMuted}
        onMutedChange={setReelsMuted}
        onPlaybackStateChange={handlePlaybackStateChange}
        onSummarySheetStateChange={handleSummarySheetStateChange}
        s={s}
      />
    ),
    [
      isPlaybackActive,
      activeIndex,
      handleSummarySheetStateChange,
      handlePlaybackStateChange,
      insets.bottom,
      insets.top,
      isReelsMuted,
      replayKey,
      s,
      screenHeight,
      screenWidth,
    ],
  );
  const handleReelsAdLoadStateChange = useCallback(
    (status: NativeAdLoadStatus) => {
      if (status === "unavailable") setReelsAdsUnavailable(true);
    },
    [],
  );
  const organicReelItems = useMemo(
    () =>
      reelItems.flatMap((item) =>
        isReelsContentItem(item) ? [item.content] : [],
      ),
    [reelItems],
  );
  const activeOrganicIndex = activeReelItem
    ? organicReelItems.findIndex((item) => item.id === activeReelItem.id)
    : -1;

  if (reelItems.length === 0) {
    return (
      <View style={styles.empty}>
        <StatusBar barStyle="light-content" />
        {isLoading ? (
          <Text style={styles.emptyTitle}>릴스를 불러오는 중이에요</Text>
        ) : (
          <AsyncStateNotice
            appearance="inverse"
            isRetrying={isFetching}
            message={
              isError
                ? "네트워크 연결 상태를 확인하고 다시 시도해주세요."
                : "새 공구 영상이 등록되면 여기에서 확인할 수 있어요."
            }
            onRetry={isError ? refetch : undefined}
            style={styles.emptyNotice}
            testID="reels-query-state"
            title={
              isError
                ? "릴스 영상을 불러오지 못했어요"
                : "표시할 릴스 영상이 없어요"
            }
            variant={isError ? "error" : "empty"}
          />
        )}
      </View>
    );
  }

  return (
    <View style={s.safeArea}>
      <StatusBar barStyle="light-content" />
      {isError ? (
        <View style={styles.staleOverlay}>
          <AsyncStateNotice
            appearance="inverse"
            compact
            isRetrying={isFetching}
            message="저장된 릴스를 계속 재생하고 있어요."
            onRetry={refetch}
            testID="reels-query-state"
            title="최신 릴스를 확인하지 못했어요"
            variant="stale"
          />
        </View>
      ) : null}
      <PagerView
        key={reelPagerKey}
        ref={pagerRef}
        initialPage={activeIndex}
        offscreenPageLimit={1}
        onPageSelected={(event) => {
          const next = event.nativeEvent.position;
          if (next !== activeIndex) {
            setReelDirection(next > activeIndex ? 1 : -1);
            setReelWindow((current) =>
              moveReelWindow(current, baseBatch, next),
            );
          }
        }}
        orientation="vertical"
        overdrag
        scrollEnabled={
          screenHeight > 0 && reelItems.length > 1 && !summarySheetGate.isOpen
        }
        style={s.verticalPager}
      >
        {reelItems.map((item, index) => {
          const shouldRenderPage = shouldRenderReelPage(index, activeIndex);

          return (
            <View
              key={`${item.key}-${reelWindow.sourceStart + index}`}
              collapsable={false}
              style={[s.verticalPagerPage, { height: screenHeight }]}
            >
              {shouldRenderPage ? (
                isReelsContentItem(item) ? (
                  renderReelItem(item.content, index)
                ) : (
                  <View style={styles.adPage}>
                    <View
                      accessibilityLiveRegion="polite"
                      style={styles.adLoading}
                    >
                      <Text style={styles.adLoadingLabel}>광고</Text>
                      <Text style={styles.adLoadingText}>
                        광고를 불러오는 중이에요
                      </Text>
                    </View>
                    <NativeAdCard
                      onLoadStateChange={handleReelsAdLoadStateChange}
                      placement="reels"
                      testID={`reels-native-ad-${item.sequence}`}
                      variant="reel"
                      visible={index === activeIndex}
                    />
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </PagerView>
      {/* Keep the lifecycle-owned distant preloader mounted while Reels is focused. */}
      {Platform.OS !== "web" && isTabFocused ? (
        <ReelVideoPreloader
          items={organicReelItems}
          activeIndex={activeOrganicIndex}
          direction={reelDirection}
          enabled={
            activeOrganicIndex >= 0 &&
            isPlaybackActive &&
            !summarySheetGate.isOpen
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  adPage: {
    backgroundColor: "#05070A",
    flex: 1,
  },
  adLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  adLoadingLabel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 12,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adLoadingText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "500",
  },
  empty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#05070A",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    color: "#A7AFBE",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  emptyNotice: {
    alignSelf: "stretch",
  },
  staleOverlay: {
    left: 12,
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 20,
  },
});
