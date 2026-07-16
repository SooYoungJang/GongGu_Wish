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
import { spacing } from "../../design/tokens";
import type { CommerceColorPalette } from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
  RankingLoadState,
} from "../../features/ranking/types";
import { RankingTopThree } from "./RankingTopThree";
import { SellerRankingRow } from "./SellerRankingRow";

type RankingItemAction = (...args: [GroupBuyRankingItem]) => void;

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

export function SellerRankingList({
  state,
  bottomPadding = 0,
  onRefresh,
  onPressItem,
  onPressSeller,
  onToggleAlert,
  onScroll,
  listRef,
  topInset = spacing.sm,
}: SellerRankingListProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const contentContainerStyle = useMemo(
    () => [s.content, { paddingTop: topInset }],
    [s.content, topInset],
  );
  const statusViewportStyle = useMemo(
    () => [s.statusContainer, { paddingTop: topInset }],
    [s.statusContainer, topInset],
  );
  const renderItem: ListRenderItem<RankingListItem> = useCallback(
    ({ item }) => (
      <SellerRankingRow
        item={item}
        onPress={onPressItem ?? NOOP}
        onPressSeller={onPressSeller}
        onToggleAlert={onToggleAlert ?? NOOP}
      />
    ),
    [onPressItem, onPressSeller, onToggleAlert],
  );
  if (state.status === "loading") {
    return (
      <View
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

  const topThree = state.data.filter(
    (item) => item.rank >= 1 && item.rank <= 3,
  );
  const remainingItems = state.data.filter(
    (item) => item.rank < 1 || item.rank > 3,
  );

  return (
    <Animated.FlatList
      accessibilityLabel="공구 랭킹 목록"
      accessibilityRole="list"
      alwaysBounceVertical={false}
      contentContainerStyle={contentContainerStyle}
      data={remainingItems}
      keyExtractor={(item) => item.groupBuyId}
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
        </>
      }
      ListFooterComponent={<View style={{ height: bottomPadding }} />}
      ref={listRef}
      onScroll={onScroll}
      onRefresh={onRefresh}
      progressViewOffset={spacing.lg}
      refreshing={"refreshing" in state ? !!state.refreshing : false}
      renderItem={renderItem}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ bottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
      style={s.list}
    />
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: spacing.lg,
    },
    fullStatus: {
      alignSelf: "stretch",
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
      paddingHorizontal: spacing["2xl"],
      paddingBottom: spacing["3xl"],
    },
  });
}
