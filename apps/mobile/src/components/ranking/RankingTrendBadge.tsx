import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { borderRadius, rankingColors, spacing } from '../../design/tokens';
import type { RankingTrend } from '../../features/ranking/types';

export interface RankingTrendBadgeProps {
  trend: RankingTrend;
}

function getTrendViewModel(trend: RankingTrend) {
  switch (trend.kind) {
    case 'up':
      return {
        label: `▲ ${trend.delta}`,
        accessibilityLabel: `순위 ${trend.delta}단계 상승`,
        palette: rankingColors.movement.up,
      };
    case 'down':
      return {
        label: `▼ ${trend.delta}`,
        accessibilityLabel: `순위 ${trend.delta}단계 하락`,
        palette: rankingColors.movement.down,
      };
    case 'new':
      return {
        label: 'NEW',
        accessibilityLabel: '새롭게 진입한 셀러',
        palette: rankingColors.movement.new,
      };
    case 'same':
      return {
        label: '-',
        accessibilityLabel: '순위 변동 없음',
        palette: rankingColors.movement.same,
      };
  }
}

export function RankingTrendBadge({ trend }: RankingTrendBadgeProps) {
  const viewModel = getTrendViewModel(trend);

  return (
    <View
      style={[styles.badge, { backgroundColor: viewModel.palette.bg }]}
      accessibilityLabel={viewModel.accessibilityLabel}
    >
      <SText variant="badge" style={[styles.text, { color: viewModel.palette.text }]}>{viewModel.label}</SText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
  },
});
