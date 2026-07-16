import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type FlatList,
  type LayoutChangeEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  RankingBasisBar,
  RankingCategoryChips,
  SellerRankingList,
} from "../components/ranking";
import { SearchGlyph } from "../components/ui/LineGlyphs";
import { SText } from "../components/ui/SText";
import { ScreenHeader } from "../components/ScreenHeader";
import { spacing } from "../design/tokens";
import { commerceRadius, type CommerceColorPalette } from "../design/commerce";
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
import { useTabReselect } from "../hooks/useTabReselect";
import type { StoreScreenProps, GroupBuy } from "../types";

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_MARGIN = spacing.lg;
const FLOATING_TAB_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;
const DEFAULT_FILTER_HEADER_HEIGHT = 240;

// 랭킹 행을 GroupBuy로 변환해 useNotifications.toggleNotification에 넘긴다.
// startDate/endDate가 있으면 시작 1시간 전 푸시가 예약되고, 없어도 알림 항목은
// 마이페이지·릴스가 읽는 공유 스토어에 저장된다.
function rankingToGroupBuy(item: GroupBuyRankingItem): GroupBuy {
  const displayName = item.productName ?? item.brandName ?? item.username;
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
      influencer: { instagramUsername: item.username || displayName },
    },
  };
}

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [selectedCategory, setSelectedCategory] =
    useState<RankingCategory>("all");
  const [period, setPeriod] = useState<RankingPeriod>("weekly");
  const [sort, setSort] = useState<RankingSort>("popular");
  const [filterHeaderHeight, setFilterHeaderHeight] = useState(
    DEFAULT_FILTER_HEADER_HEIGHT,
  );
  const measuredFilterHeaderHeightRef = useRef(DEFAULT_FILTER_HEADER_HEIGHT);
  const rankingListRef = useRef<FlatList<RankingListItem>>(null);

  const rankingState = usePopularGroupBuys(period, selectedCategory, sort);
  const rankingUpdatedAt =
    rankingState.status === "ready" || rankingState.status === "empty"
      ? rankingState.updatedAt
      : undefined;
  const { isNotifying, getNotificationState, toggleNotification } =
    useNotifications();

  const patchedRankingState = useMemo(() => {
    if (rankingState.status !== "ready" || !rankingState.data)
      return rankingState;
    return {
      ...rankingState,
      data: rankingState.data.map((item) => ({
        ...item,
        // 알림 버튼은 진짜 알림 설정 상태를 반영한다. useNotifications 스토어는
        // 마이페이지("알림 설정한 공구")와 릴스(bell)가 함께 읽는 같은 저장소다.
        isNotifying: isNotifying(item.groupBuyId),
        notificationState: getNotificationState(item.groupBuyId),
      })),
    };
  }, [getNotificationState, isNotifying, rankingState]);

  const handleRankingTabReselect = useCallback(() => {
    rankingListRef.current?.scrollToOffset({ offset: 0, animated: true });
    void rankingState.refresh?.();
  }, [rankingState.refresh]);

  useTabReselect(navigation, handleRankingTabReselect);

  const bottomPadding =
    FLOATING_TAB_RESERVED_HEIGHT + insets.bottom + spacing["2xl"];

  const handleFilterHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight === measuredFilterHeaderHeightRef.current) return;
    measuredFilterHeaderHeightRef.current = nextHeight;
    setFilterHeaderHeight(nextHeight);
  }, []);

  const handlePressSeller = useCallback(
    (item: GroupBuyRankingItem) => {
      navigation.navigate("Detail", {
        groupBuy: rankingToGroupBuy(item),
      });
    },
    [navigation],
  );

  const handlePressInfluencer = useCallback(
    (item: GroupBuyRankingItem) => {
      navigation.navigate("InfluencerGroupBuys", {
        influencerUsername: item.username,
        influencerDisplayName: item.brandName,
      });
    },
    [navigation],
  );

  const handleToggleNotification = useCallback(
    (item: GroupBuyRankingItem) => {
      // 진짜 알림 등록/해제: useNotifications 스토어에 쓰면 마이페이지·릴스에 즉시 반영되고,
      // startDate가 있으면 시작 1시간 전 푸시도 예약된다.
      void toggleNotification(rankingToGroupBuy(item));
    },
    [toggleNotification],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <View style={s.contentShell}>
        <View style={s.header}>
          <ScreenHeader
            title="인기 공구 랭킹"
            right={
              <Pressable
                accessibilityLabel="랭킹 검색"
                accessibilityRole="button"
                onPress={() => navigation.navigate("SearchScreen")}
                style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
              >
                <SearchGlyph color={colors.text} size={20} />
              </Pressable>
            }
          />
        </View>

        <View style={s.listContainer} testID="ranking-scroll-clip">
          <SellerRankingList
            state={patchedRankingState}
            bottomPadding={bottomPadding}
            listRef={rankingListRef}
            onRefresh={rankingState.refresh}
            onPressItem={handlePressSeller}
            onPressSeller={handlePressInfluencer}
            onToggleAlert={handleToggleNotification}
            topInset={filterHeaderHeight + spacing.sm}
          />

          <View
            onLayout={handleFilterHeaderLayout}
            style={s.filterHeader}
            testID="ranking-filter-header"
          >
            <RankingBasisBar
              category={selectedCategory}
              period={period}
              sort={sort}
              updatedAt={rankingUpdatedAt}
            />
            <View accessibilityRole="tablist" style={s.periodRow}>
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
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
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
      paddingBottom: spacing.sm,
      paddingTop: spacing.sm,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 3,
    },
    header: {
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    iconButton: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      height: 42,
      justifyContent: "center",
      width: 42,
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
      borderBottomColor: colors.text,
    },
    selectedPeriodText: {
      color: colors.text,
      fontWeight: "900",
    },
  });
}
