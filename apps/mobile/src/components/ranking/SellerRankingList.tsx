import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { RankingThumbnail, SellerRanking, RankingLoadState } from '../../features/ranking/types';
import { SellerRankingRow } from './SellerRankingRow';

export interface SellerRankingListProps {
  state: RankingLoadState;
  bottomPadding?: number;
  onRefresh?: () => void;
  onPressItem?: (item: SellerRanking) => void;
  onPressThumbnail?: (thumbnail: RankingThumbnail, item: SellerRanking) => void;
  onToggleFollow?: (item: SellerRanking) => void;
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

export function SellerRankingList({
  state,
  bottomPadding = 0,
  onRefresh,
  onPressItem,
  onPressThumbnail,
  onToggleFollow,
}: SellerRankingListProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  if (state.status === 'loading') {
    return (
      <View style={s.statusContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={s.statusContainer}>
        <SText variant="body" style={[s.statusTitle, s.errorText]}>{state.message}</SText>
        {state.retry ? (
          <Pressable accessibilityLabel="다시 불러오기" accessibilityRole="button" onPress={state.retry} style={s.statusAction}>
            <SText variant="label" style={s.statusActionText}>다시 시도</SText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.status === 'empty') {
    return (
      <View style={s.statusContainer}>
        <SText variant="body" style={s.statusTitle}>{state.message}</SText>
        {state.action ? (
          <Pressable accessibilityLabel={state.action.label} accessibilityRole="button" onPress={state.action.onPress} style={s.statusAction}>
            <SText variant="label" style={s.statusActionText}>{state.action.label}</SText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <FlatList
      accessibilityLabel="셀러 랭킹 목록"
      accessibilityRole="list"
      data={state.data}
      ItemSeparatorComponent={RowSeparator}
      keyExtractor={(item) => item.id}
      ListFooterComponent={<View style={{ height: bottomPadding }} />}
      onRefresh={onRefresh}
      progressViewOffset={spacing.lg}
      refreshing={'refreshing' in state ? !!state.refreshing : false}
      scrollIndicatorInsets={{ bottom: bottomPadding }}
      renderItem={({ item }) => (
        <SellerRankingRow
          item={item}
          onPress={onPressItem ?? (() => {})}
          onPressThumbnail={onPressThumbnail}
          onToggleFollow={onToggleFollow ?? (() => {})}
        />
      )}
      style={s.list}
    />
  );
}

const styles = StyleSheet.create({
  separator: {
    height: spacing.sm,
  },
});

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    errorText: {
      color: colors.error,
    },
    list: {
      backgroundColor: colors.bg,
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
      fontWeight: '900',
    },
    statusContainer: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      marginTop: spacing.md,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing['3xl'],
    },
    statusTitle: {
      color: colors.text,
      fontWeight: '800',
      lineHeight: 22,
      textAlign: 'center',
    },
  });
}
