import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type FlatListProps,
  type FlatList,
  type ListRenderItem,
} from "react-native";
import type { Ref } from "react";

import { SText } from "../ui/SText";
import { spacing } from "../../design/tokens";
import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type {
  GroupBuyRankingItem,
  RankingListItem,
  RankingLoadState,
} from "../../features/ranking/types";
import { SellerRankingRow } from "./SellerRankingRow";

export interface SellerRankingListProps {
  state: RankingLoadState;
  bottomPadding?: number;
  onRefresh?: () => void;
  onPressItem?: (item: GroupBuyRankingItem) => void;
  onToggleAlert?: (item: GroupBuyRankingItem) => void;
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
  const renderItem: ListRenderItem<RankingListItem> = useCallback(
    ({ item }) => (
      <SellerRankingRow
        item={item}
        onPress={onPressItem ?? NOOP}
        onToggleAlert={onToggleAlert ?? NOOP}
      />
    ),
    [onPressItem, onToggleAlert],
  );
  if (state.status === "loading") {
    return (
      <View style={s.statusContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={s.statusContainer}>
        <SText variant="body" style={[s.statusTitle, s.errorText]}>
          {state.message}
        </SText>
        {state.retry ? (
          <Pressable
            accessibilityLabel="다시 불러오기"
            accessibilityRole="button"
            onPress={state.retry}
            style={s.statusAction}
          >
            <SText variant="label" style={s.statusActionText}>
              다시 시도
            </SText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.status === "empty") {
    return (
      <View style={s.statusContainer}>
        <SText variant="body" style={s.statusTitle}>
          {state.message}
        </SText>
        {state.action ? (
          <Pressable
            accessibilityLabel={state.action.label}
            accessibilityRole="button"
            onPress={state.action.onPress}
            style={s.statusAction}
          >
            <SText variant="label" style={s.statusActionText}>
              {state.action.label}
            </SText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Animated.FlatList
      accessibilityLabel="공구 랭킹 목록"
      accessibilityRole="list"
      alwaysBounceVertical={false}
      contentContainerStyle={contentContainerStyle}
      data={state.data}
      keyExtractor={(item) => item.groupBuyId}
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
    errorText: {
      color: colors.error,
    },
    list: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    statusAction: {
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.full,
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    statusActionText: {
      color: colors.inverse,
      fontWeight: "900",
    },
    statusContainer: {
      alignItems: "center",
      backgroundColor: colors.bg,
      flex: 1,
      justifyContent: "center",
      marginTop: spacing.md,
      paddingHorizontal: spacing["2xl"],
      paddingVertical: spacing["3xl"],
    },
    statusTitle: {
      color: colors.text,
      fontWeight: "800",
      lineHeight: 22,
      textAlign: "center",
    },
  });
}
