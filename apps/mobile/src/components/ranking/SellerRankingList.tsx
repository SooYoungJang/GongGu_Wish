import { FlatList, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../design/tokens';
import type { RankingLoadState, RankingThumbnail, SellerRanking } from '../../features/ranking/types';
import { SellerRankingRow } from './SellerRankingRow';

export interface SellerRankingListProps {
  state: RankingLoadState;
  bottomPadding: number;
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
  bottomPadding,
  onRefresh,
  onPressItem,
  onPressThumbnail,
  onToggleFollow,
}: SellerRankingListProps) {
  if (state.status === 'loading' && !state.data) {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>랭킹을 불러오는 중…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusErrorText}>{state.message}</Text>
        {state.retry ? (
          <Text
            accessible
            accessibilityLabel="다시 불러오기"
            onPress={state.retry}
            style={styles.statusActionText}
          >
            다시 시도
          </Text>
        ) : null}
      </View>
    );
  }

  if (state.status === 'empty') {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{state.message}</Text>
        {state.action ? (
          <Text
            accessible
            accessibilityLabel={state.action.label}
            onPress={state.action.onPress}
            style={styles.statusActionText}
          >
            {state.action.label}
          </Text>
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
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.bg,
  },
  separator: {
    height: spacing.sm,
  },
  statusActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  statusContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  statusErrorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
