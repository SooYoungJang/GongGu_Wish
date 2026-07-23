import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  View,
  type FlatListProps,
  type FlatList,
  type ListRenderItem,
} from "react-native";
import type { Ref } from "react";

import { AsyncStateNotice } from "../ui/AsyncStateNotice";
import { NativeAdCard } from "../ads/NativeAdCard";
import type { NativeAdLoadStatus } from "../ads/NativeAdCard.types";
import { useAds } from "../../ads/AdsContext";
import {
  insertReelsAdSlots,
  isReelsContentItem,
  type ReelsFeedItem,
} from "../../screens/reelsAdPlacement";
import { SText } from "../ui/SText";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
  RankingLoadState,
} from "../../features/ranking/types";
import { RankingTopThree } from "./RankingTopThree";
import { SellerRankingRow } from "./SellerRankingRow";

type RankingItemAction = (item: GroupBuyRankingItem) => void;

export interface SellerRankingListProps {
  state: RankingLoadState;
  bottomPadding?: number;
  onRefresh?: () => void;
  onPressItem?: RankingItemAction;
  onPressSeller?: RankingItemAction;
  onToggleAlert?: RankingItemAction;
  topInset?: number;
  onScroll?: FlatListProps<RankingListItem>["onScroll"];
  listRef?: Ref<FlatList<RankingFeedItem>>;
}

const NOOP = () => undefined;
const EMPTY_RANKINGS: readonly RankingListItem[] = [];

// insertReelsAdSlots requires { id: string }; RankingListItem uses groupBuyId.
export type RankingAdItem = { id: string } & RankingListItem;
export type RankingFeedItem = ReelsFeedItem<RankingAdItem>;

const FEED_KEY_EXTRACTOR = (item: RankingFeedItem) => item.key;

function wrapForAdInsertion(
  items: RankingListItem[],
): RankingAdItem[] {
  return items.map((item) => ({ ...item, id: item.groupBuyId }));
}

export function SellerRankingList({
  state,
  bottomPadding = 0,
  onRefresh,
  onPressItem,
  onPressSeller,
  onToggleAlert,
  onScroll,
  listRef,
  topInset,
}: SellerRankingListProps) {
  const theme = useCommerceTheme();
  const { colors, spacing } = theme;
  const s = useMemo(() => makeStyles(theme), [theme]);
  const resolvedTopInset = topInset ?? spacing.sm;
  const contentContainerStyle = useMemo(
    () => [s.content, { paddingTop: resolvedTopInset }],
    [resolvedTopInset, s.content],
  );
  const statusViewportStyle = useMemo(
    () => [s.statusContainer, { paddingTop: resolvedTopInset }],
    [resolvedTopInset, s.statusContainer],
  );
  const readyData = state.status === "ready" ? state.data : EMPTY_RANKINGS;
  const { remainingItems, topThree } = useMemo(() => {
    let leadingTopCount = 0;
    while (leadingTopCount < Math.min(3, readyData.length)) {
      const rank = readyData[leadingTopCount].rank;
      if (rank < 1 || rank > 3) break;
      leadingTopCount += 1;
    }

    return {
      topThree: readyData.slice(0, leadingTopCount),
      remainingItems: readyData.slice(leadingTopCount),
    };
  }, [readyData]);
  const { enabled: adsEnabled, isReady: adsReady, nativeUnitIds } = useAds();
  const [rankingAdsUnavailable, setRankingAdsUnavailable] = useState(false);
  const canShowRankingAds =
    adsEnabled &&
    adsReady &&
    Boolean(nativeUnitIds.home) &&
    !rankingAdsUnavailable;
  const feedItems = useMemo<RankingFeedItem[]>(
    () =>
      insertReelsAdSlots(wrapForAdInsertion(remainingItems), {
        enabled: canShowRankingAds,
      }),
    [canShowRankingAds, remainingItems],
  );
  const handleRankingAdLoadStateChange = useCallback(
    (status: NativeAdLoadStatus) => {
      if (status === "unavailable") setRankingAdsUnavailable(true);
    },
    [],
  );
  const footerStyle = useMemo(
    () => [s.footer, { height: bottomPadding }],
    [bottomPadding, s.footer],
  );
  const scrollIndicatorInsets = useMemo(
    () => ({ bottom: bottomPadding }),
    [bottomPadding],
  );
  const renderItem: ListRenderItem<RankingFeedItem> = useCallback(
    ({ item }) => {
      if (!isReelsContentItem(item)) {
        return (
          <View style={s.adCard}>
            <NativeAdCard
              onLoadStateChange={handleRankingAdLoadStateChange}
              placement="home"
              testID={`ranking-native-ad-${item.sequence}`}
            />
          </View>
        );
      }
      return (
        <SellerRankingRow
          item={item.content}
          onPress={onPressItem ?? NOOP}
          onPressSeller={onPressSeller}
          onToggleAlert={onToggleAlert ?? NOOP}
        />
      );
    },
    [handleRankingAdLoadStateChange, onPressItem, onPressSeller, onToggleAlert],
  );
  if (state.status === "loading") {
    return (
      <View
        accessible
        accessibilityLabel="랭킹 불러오는 중"
        accessibilityRole="progressbar"
        style={statusViewportStyle}
        testID="ranking-status-viewport"
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View
        style={statusViewportStyle}
        testID="ranking-status-viewport"
      >
        <AsyncStateNotice
          message={state.message}
          onRetry={state.retry}
          style={s.fullStatus}
          title="랭킹을 불러오지 못했어요"
          variant="error"
        />
      </View>
    );
  }

  if (state.status === "empty") {
    return (
      <View
        style={statusViewportStyle}
        testID="ranking-status-viewport"
      >
        <AsyncStateNotice
          actionLabel={state.action?.label}
          onRetry={state.action?.onPress}
          style={s.fullStatus}
          title={state.message}
          variant="empty"
        />
      </View>
    );
  }

  return (
    <Animated.FlatList
      accessibilityLabel="공구 랭킹 목록"
      accessibilityRole="list"
      alwaysBounceVertical={false}
      contentContainerStyle={contentContainerStyle}
      data={feedItems}
      keyExtractor={FEED_KEY_EXTRACTOR}
      ListHeaderComponent={
        <>
          {state.refreshError ? (
            <AsyncStateNotice
              compact
              message="저장된 랭킹을 계속 표시하고 있어요."
              onRetry={state.refresh}
              title={state.refreshError}
              variant="stale"
            />
          ) : null}
          {topThree.length > 0 ? (
            <RankingTopThree
              items={topThree}
              onPress={onPressItem ?? NOOP}
              onPressSeller={onPressSeller}
              onToggleAlert={onToggleAlert ?? NOOP}
            />
          ) : null}
          {remainingItems.length > 0 ? (
            <View style={s.listHeading} testID="ranking-list-heading">
              <SText accessibilityRole="header" style={s.listHeadingTitle} variant="cardTitle">
                계속 인기 중
              </SText>
              <SText style={s.listHeadingCaption} variant="caption">
                4위부터도 같은 기준으로 집계해요
              </SText>
            </View>
          ) : null}
        </>
      }
      ListFooterComponent={<View style={footerStyle} />}
      ref={listRef}
      onScroll={onScroll}
      onRefresh={onRefresh}
      progressViewOffset={resolvedTopInset + spacing.lg}
      refreshing={"refreshing" in state ? !!state.refreshing : false}
      renderItem={renderItem}
      scrollEventThrottle={16}
      scrollIndicatorInsets={scrollIndicatorInsets}
      showsVerticalScrollIndicator={false}
      style={s.list}
    />
  );
}

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    adCard: {
      backgroundColor: colors.cardBg,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
      overflow: "hidden",
    },
    content: {
      paddingHorizontal: spacing.lg,
    },
    fullStatus: {
      alignSelf: "stretch",
    },
    footer: {
      width: "100%",
    },
    list: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    listHeading: {
      gap: spacing.xxs,
      paddingBottom: spacing.sm,
      paddingTop: spacing.xs,
    },
    listHeadingCaption: {
      color: colors.muted,
    },
    listHeadingTitle: {
      color: colors.text,
      ...typography.sectionTitle,
    },
    statusContainer: {
      alignItems: "center",
      backgroundColor: colors.bg,
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.section,
    },
  });
}
