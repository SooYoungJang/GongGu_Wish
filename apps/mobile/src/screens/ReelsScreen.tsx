import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import PagerView from "react-native-pager-view";

import { fetchGroupBuys } from "../api";
import { logDeepView } from "../api";
import { useRecentViews } from "../hooks/useLocalDeals";
import { useTabReselect } from "../hooks/useTabReselect";
import { useTheme } from "../context/ThemeContext";
import type { GroupBuy, MainTabParamList } from "../types";
import { getRandomReelIndex } from "./reelNavigation";
import {
  ProductReelPage,
  ReelVideoPreloader,
  makeStyles,
} from "./DetailScreen";
import {
  createReelWindow,
  moveReelWindow,
  type ReelWindow,
} from "./reelWindow";

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
  const pagerRef = useRef<PagerView>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [reelDirection, setReelDirection] = useState<1 | -1>(1);
  const [reelWindow, setReelWindow] = useState<ReelWindow<GroupBuy>>(() =>
    createReelWindow([]),
  );
  const { activeIndex, items: reelItems } = reelWindow;
  const [summarySheetGate, setSummarySheetGate] = useState({
    isOpen: false,
    canSwipeReel: true,
  });
  const [isTabFocused, setTabFocused] = useState(true);
  const [isAppActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const { recordView } = useRecentViews();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppActive(nextState === "active");
    });

    return () => subscription.remove();
  }, []);

  const isPlaybackActive = isTabFocused && isAppActive;

  useEffect(() => {
    onSheetVisibilityChange?.(summarySheetGate.isOpen);
  }, [onSheetVisibilityChange, summarySheetGate.isOpen]);

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      return () => setTabFocused(false);
    }, []),
  );

  const { data, isError, isLoading } = useQuery({
    queryKey: ["group-buys"],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  // Base shuffled batch, refreshed each time data arrives.
  const baseBatch = useMemo<GroupBuy[]>(() => {
    return shuffle(data ?? []);
  }, [data]);

  useEffect(() => {
    if (baseBatch.length === 0) return;
    setReelWindow(createReelWindow(baseBatch));
    setReelDirection(1);
  }, [baseBatch]);

  const handleReelsTabReselect = useCallback(() => {
    if (reelItems.length === 0) return;

    const nextIndex = getRandomReelIndex(reelItems.length, activeIndex);
    setReelDirection(nextIndex >= activeIndex ? 1 : -1);
    const nextWindow = moveReelWindow(reelWindow, baseBatch, nextIndex);
    setReelWindow(nextWindow);
    setReplayKey((key) => key + 1);
    if (nextWindow.sourceStart === reelWindow.sourceStart) {
      pagerRef.current?.setPageWithoutAnimation?.(nextWindow.activeIndex);
    }
  }, [activeIndex, baseBatch, reelItems.length, reelWindow]);

  useTabReselect(navigation, handleReelsTabReselect);

  const activeReelItem = reelItems[activeIndex];
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
  const DEEP_VIEW_THRESHOLD_MS = 10_000;
  const deepViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (deepViewTimerRef.current) {
      clearTimeout(deepViewTimerRef.current);
      deepViewTimerRef.current = null;
    }
    // Only track while the tab is focused and no overlay sheet is open.
    if (isPlaybackActive && !summarySheetGate.isOpen && activeReelItem) {
      const id = activeReelItem.id;
      deepViewTimerRef.current = setTimeout(() => {
        void Promise.resolve(logDeepView(id)).catch(() => undefined);
      }, DEEP_VIEW_THRESHOLD_MS);
    }
    return () => {
      if (deepViewTimerRef.current) {
        clearTimeout(deepViewTimerRef.current);
        deepViewTimerRef.current = null;
      }
    };
  }, [isPlaybackActive, summarySheetGate.isOpen, activeReelItem]);

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
        replayKey={replayKey}
        shouldPreloadVideo={Math.abs(index - activeIndex) <= 1}
        bottomChromeOffset={REELS_TAB_BAR_OVERLAY_OFFSET}
        pageHeight={screenHeight}
        mediaWidth={screenWidth}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={NOOP}
        showBackButton={false}
        onSummarySheetStateChange={handleSummarySheetStateChange}
        s={s}
      />
    ),
    [
      isPlaybackActive,
      activeIndex,
      handleSummarySheetStateChange,
      insets.bottom,
      insets.top,
      replayKey,
      s,
      screenHeight,
      screenWidth,
    ],
  );

  if (reelItems.length === 0) {
    return (
      <View style={styles.empty}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.emptyTitle}>
          {isLoading
            ? "릴스를 불러오는 중이에요"
            : isError
              ? "릴스 영상을 불러오지 못했어요"
              : "표시할 릴스 영상이 없어요"}
        </Text>
        <Text style={styles.emptyDescription}>
          {isError
            ? "네트워크 연결 상태를 확인하고 다시 시도해주세요."
            : "새 공구 영상이 등록되면 여기에서 확인할 수 있어요."}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.safeArea}>
      <StatusBar barStyle="light-content" />
      <PagerView
        key={`${reelWindow.sourceStart}-${reelItems[0]?.id ?? "empty"}-${reelItems.length}`}
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
              key={`${item.id}-${reelWindow.sourceStart + index}`}
              collapsable={false}
              style={[s.verticalPagerPage, { height: screenHeight }]}
            >
              {shouldRenderPage ? renderReelItem(item, index) : null}
            </View>
          );
        })}
      </PagerView>
      {/* Keep the lifecycle-owned distant preloader mounted while Reels is focused. */}
      {Platform.OS !== "web" && isTabFocused ? (
        <ReelVideoPreloader
          items={reelItems}
          activeIndex={activeIndex}
          direction={reelDirection}
          enabled={isPlaybackActive && !summarySheetGate.isOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
