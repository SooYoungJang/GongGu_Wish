import { useCallback, useMemo } from "react";
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
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { getTopPopularityScore } from "../../features/ranking/popularityPresentation";
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
  listRef?: Ref<FlatList<RankingListItem>>;
}

const NOOP = () => undefined;
const KEY_EXTRACTOR = (item: RankingListItem) => item.groupBuyId;
const EMPTY_RANKINGS: readonly RankingListItem[] = [];

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
  const { remainingItems, topScore, topThree } = useMemo(() => {
    const comparisonScore = getTopPopularityScore(
      readyData.map((item) => item.metrics.score),
    );
    let leadingTopCount = 0;
    while (leadingTopCount < Math.min(3, readyData.length)) {
      const rank = readyData[leadingTopCount].rank;
      if (rank < 1 || rank > 3) break;
      leadingTopCount += 1;
    }

    return {
      topScore: comparisonScore,
      topThree: readyData.slice(0, leadingTopCount),
      remainingItems: readyData.slice(leadingTopCount),
    };
  }, [readyData]);
  const footerStyle = useMemo(
    () => [s.footer, { height: bottomPadding }],
    [bottomPadding, s.footer],
  );
  const scrollIndicatorInsets = useMemo(
    () => ({ bottom: bottomPadding }),
    [bottomPadding],
  );
  const renderItem: ListRenderItem<RankingListItem> = useCallback(
    ({ item }) => (
      <SellerRankingRow
        item={item}
        onPress={onPressItem ?? NOOP}
        onPressSeller={onPressSeller}
        onToggleAlert={onToggleAlert ?? NOOP}
        topScore={topScore}
      />
    ),
    [onPressItem, onPressSeller, onToggleAlert, topScore],
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
      data={remainingItems}
      keyExtractor={KEY_EXTRACTOR}
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
              topScore={topScore}
            />
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
  const { colors, spacing } = theme;
  return StyleSheet.create({
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
