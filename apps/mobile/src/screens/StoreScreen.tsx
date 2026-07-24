import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { normalizeOptionalInstagramUsername } from "@gonggu/shared/utils/instagram";

import {
  RankingCategoryChips,
  SellerRankingList,
} from "../components/ranking";
import { SearchGlyph } from "../components/ui/LineGlyphs";
import { SText } from "../components/ui/SText";
import { ScreenHeader } from "../components/ScreenHeader";
import { useCommerceTheme } from "../design/useCommerceTheme";
import {
  RANKING_CATEGORIES,
  RANKING_PERIOD_LABELS,
  type GroupBuyRankingItem,
  type RankingListItem,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
} from "../features/ranking/types";
import { usePopularGroupBuys } from "../features/ranking/usePopularGroupBuys";
import { useNotifications } from "../hooks/useLocalDeals";
import { useAuthGate } from "../hooks/useAuthGate";
import { useTabReselect } from "../hooks/useTabReselect";
import type { GroupBuyAlertState } from "../services/notifications";
import type { StoreScreenProps, GroupBuy } from "../types";

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const DEFAULT_FILTER_HEADER_HEIGHT = 141;
const DEFAULT_COLLAPSIBLE_FILTER_HEIGHT = 96;

type RankingItemCacheEntry = {
  source: GroupBuyRankingItem;
  isNotifying: boolean;
  notificationStateKey: string;
  item: RankingListItem;
};

// 랭킹 행을 GroupBuy로 변환해 useNotifications.toggleNotification에 넘긴다.
// startDate/endDate가 있으면 시작 1시간 전 푸시가 예약되고, 없어도 알림 항목은
// 마이페이지·릴스가 읽는 공유 스토어에 저장된다.
function rankingToGroupBuy(item: GroupBuyRankingItem): GroupBuy {
  const username = normalizeOptionalInstagramUsername(item.username);
  return {
    id: item.groupBuyId,
    productName: item.productName,
    brandName: item.brandName,
    category: item.category,
    startDate: item.startDate,
    endDate: item.endDate,
    priceKrw: item.priceKrw,
    purchaseUrl: null,
    discountInfo: null,
    summary: null,
    confidence: 0,
    thumbnailUrl: item.thumbnailUrl ?? item.mediaUrls[0] ?? null,
    videoUrl: null,
    mediaUrls: item.mediaUrls,
    mediaType: null,
    rawPost: {
      postUrl: "",
      influencer: { instagramUsername: username ?? "" },
    },
  };
}

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useCommerceTheme();
  const { colors, spacing } = theme;
  const s = useMemo(() => makeStyles(theme), [theme]);
  const [selectedCategory, setSelectedCategory] =
    useState<RankingCategory>("all");
  const [period, setPeriod] = useState<RankingPeriod>("weekly");
  const [sort, setSort] = useState<RankingSort>("popular");
  const [filterHeaderHeight, setFilterHeaderHeight] = useState(
    DEFAULT_FILTER_HEADER_HEIGHT,
  );
  const [collapsibleFilterHeight, setCollapsibleFilterHeight] = useState(
    DEFAULT_COLLAPSIBLE_FILTER_HEIGHT,
  );
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const measuredFilterHeaderHeightRef = useRef(DEFAULT_FILTER_HEADER_HEIGHT);
  const measuredCollapsibleFilterHeightRef = useRef(
    DEFAULT_COLLAPSIBLE_FILTER_HEIGHT,
  );
  const rankingScrollY = useRef(new Animated.Value(0)).current;
  const rankingListRef = useRef<FlatList<RankingListItem>>(null);
  const filtersCollapsedRef = useRef(false);
  const rankingItemCacheRef = useRef(new Map<string, RankingItemCacheEntry>());

  const rankingState = usePopularGroupBuys(period, selectedCategory, sort);
  const { isNotifying, getNotificationState, toggleNotification } =
    useNotifications();
  const { requireAuth } = useAuthGate();

  const patchedRankingState = useMemo(() => {
    if (rankingState.status !== "ready" || !rankingState.data)
      return rankingState;
    const nextCache = new Map<string, RankingItemCacheEntry>();
    const data = rankingState.data.map((item) => {
      const notifying = isNotifying(item.groupBuyId);
      const notificationState = getNotificationState(item.groupBuyId);
      const notificationStateKey = getNotificationStateKey(notificationState);
      const cached = rankingItemCacheRef.current.get(item.groupBuyId);
      if (
        cached?.source === item &&
        cached.isNotifying === notifying &&
        cached.notificationStateKey === notificationStateKey
      ) {
        nextCache.set(item.groupBuyId, cached);
        return cached.item;
      }

      const patchedItem: RankingListItem = {
        ...item,
        isNotifying: notifying,
        notificationState,
      };
      nextCache.set(item.groupBuyId, {
        source: item,
        isNotifying: notifying,
        notificationStateKey,
        item: patchedItem,
      });
      return patchedItem;
    });
    rankingItemCacheRef.current = nextCache;

    return {
      ...rankingState,
      // 알림 버튼은 진짜 알림 설정 상태를 반영한다. 변경되지 않은 항목은
      // 객체 identity를 보존해 다른 랭킹 행의 불필요한 재렌더를 막는다.
      data,
    };
  }, [getNotificationState, isNotifying, rankingState]);

  const handleRankingTabReselect = useCallback(() => {
    rankingListRef.current?.scrollToOffset({ offset: 0, animated: true });
    void rankingState.refresh?.();
  }, [rankingState.refresh]);

  useTabReselect(navigation, handleRankingTabReselect);

  const bottomPadding =
    TAB_BAR_HEIGHT + spacing.lg + insets.bottom + spacing.xxl;

  const filterTranslateY = useMemo(
    () =>
      rankingScrollY.interpolate({
        inputRange: [0, collapsibleFilterHeight],
        outputRange: [0, -collapsibleFilterHeight],
        extrapolate: "clamp",
      }),
    [collapsibleFilterHeight, rankingScrollY],
  );
  const filterAnimatedStyle = useMemo(
    () => ({ transform: [{ translateY: filterTranslateY }] }),
    [filterTranslateY],
  );
  const collapsedFilterPlaceholderStyle = useMemo(
    () => ({ height: collapsibleFilterHeight }),
    [collapsibleFilterHeight],
  );
  const handleRankingScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: rankingScrollY } } }],
        {
          useNativeDriver: true,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const nextCollapsed =
              event.nativeEvent.contentOffset.y >= collapsibleFilterHeight;
            if (nextCollapsed === filtersCollapsedRef.current) return;
            filtersCollapsedRef.current = nextCollapsed;
            setFiltersCollapsed(nextCollapsed);
          },
        },
      ),
    [collapsibleFilterHeight, rankingScrollY],
  );

  const handleFilterHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight === measuredFilterHeaderHeightRef.current) return;
    measuredFilterHeaderHeightRef.current = nextHeight;
    setFilterHeaderHeight(nextHeight);
  }, []);

  const handleCollapsibleFilterLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight === measuredCollapsibleFilterHeightRef.current) return;
      measuredCollapsibleFilterHeightRef.current = nextHeight;
      setCollapsibleFilterHeight(nextHeight);
    },
    [],
  );

  const handleSearchPress = useCallback(
    () => navigation.navigate("SearchScreen"),
    [navigation],
  );

  const handlePressRankingItem = useCallback(
    (item: GroupBuyRankingItem) => {
      navigation.navigate("Detail", {
        groupBuy: rankingToGroupBuy(item),
      });
    },
    [navigation],
  );

  const handlePressSeller = useCallback(
    (item: GroupBuyRankingItem) => {
      const username = normalizeOptionalInstagramUsername(item.username);
      if (!username) return;

      navigation.navigate("InfluencerGroupBuys", {
        influencerUsername: username,
        influencerDisplayName: item.brandName,
      });
    },
    [navigation],
  );

  const handleToggleNotification = useCallback(
    (item: GroupBuyRankingItem) => {
      if (!requireAuth()) return;
      // 진짜 알림 등록/해제: useNotifications 스토어에 쓰면 마이페이지·릴스에 즉시 반영되고,
      // startDate가 있으면 시작 1시간 전 푸시도 예약된다.
      void toggleNotification(rankingToGroupBuy(item));
    },
    [requireAuth, toggleNotification],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <View style={s.contentShell}>
        <View style={s.header}>
          <ScreenHeader
            title="인기 공구"
            right={
              <Pressable
                accessibilityLabel="랭킹 검색"
                accessibilityRole="button"
                onPress={handleSearchPress}
                style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
              >
                <SearchGlyph color={colors.text} size={20} />
              </Pressable>
            }
          />
        </View>

        <View
          style={s.listContainer}
          testID="ranking-scroll-clip"
        >
          <Animated.View
            onLayout={handleFilterHeaderLayout}
            style={[s.filterHeader, filterAnimatedStyle]}
            testID="ranking-filter-header"
          >
            <View
              accessibilityElementsHidden={filtersCollapsed}
              importantForAccessibility={
                filtersCollapsed ? "no-hide-descendants" : "auto"
              }
              onLayout={handleCollapsibleFilterLayout}
              pointerEvents={filtersCollapsed ? "none" : "auto"}
              style={[
                s.collapsibleFilters,
                filtersCollapsed ? collapsedFilterPlaceholderStyle : null,
              ]}
              testID="ranking-collapsible-filters"
            >
              {filtersCollapsed ? null : (
                <>
                  <RankingCategoryChips
                    mode="sort"
                    value={selectedCategory}
                    categories={RANKING_CATEGORIES}
                    sort={sort}
                    onChange={setSelectedCategory}
                    onChangeSort={setSort}
                  />
                  <RankingCategoryChips
                    mode="category"
                    value={selectedCategory}
                    categories={RANKING_CATEGORIES}
                    sort={sort}
                    onChange={setSelectedCategory}
                    onChangeSort={setSort}
                  />
                </>
              )}
            </View>
            <View
              accessibilityRole="tablist"
              style={s.periodRow}
              testID="ranking-period-tabs"
            >
              {(["today", "weekly", "monthly"] as const).map((nextPeriod) => {
                const selected = nextPeriod === period;
                return (
                  <Pressable
                    key={nextPeriod}
                    accessibilityLabel={`${RANKING_PERIOD_LABELS[nextPeriod]} 랭킹 기간`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setPeriod(nextPeriod)}
                    style={[s.periodTab, selected && s.selectedPeriodTab]}
                  >
                    <SText
                      variant="body"
                      style={[s.periodText, selected && s.selectedPeriodText]}
                    >
                      {RANKING_PERIOD_LABELS[nextPeriod]}
                    </SText>
                  </Pressable>
                );
              })}
            </View>

          </Animated.View>

          <SellerRankingList
            state={patchedRankingState}
            bottomPadding={bottomPadding}
            listRef={rankingListRef}
            onRefresh={rankingState.refresh}
            onScroll={handleRankingScroll}
            onPressItem={handlePressRankingItem}
            onPressSeller={handlePressSeller}
            onToggleAlert={handleToggleNotification}
            topInset={filterHeaderHeight + spacing.sm}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing } = theme;
  return StyleSheet.create({
    collapsibleFilters: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    contentShell: {
      alignSelf: "center",
      flex: 1,
      maxWidth: 720,
      width: "100%",
    },
    filterHeader: {
      backgroundColor: colors.bg,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 3,
    },
    header: {
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    iconButton: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderRadius: radius.full,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    listContainer: {
      backgroundColor: colors.bg,
      flex: 1,
      overflow: "hidden",
      position: "relative",
    },
    periodTab: {
      alignItems: "center",
      borderBottomColor: "transparent",
      borderBottomWidth: 2,
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingVertical: spacing.xs,
    },
    periodText: {
      color: colors.muted,
      fontWeight: "800",
      includeFontPadding: false,
    },
    periodRow: {
      backgroundColor: colors.bg,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
    },
    pressed: {
      opacity: 0.7,
    },
    safeArea: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    selectedPeriodTab: {
      borderBottomColor: colors.accent,
    },
    selectedPeriodText: {
      color: colors.accent,
      fontWeight: "900",
    },
  });
}

function getNotificationStateKey(state: GroupBuyAlertState): string {
  return JSON.stringify(state);
}
