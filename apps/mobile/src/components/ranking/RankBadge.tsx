import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { borderRadius, rankingColors, spacing } from '../../design/tokens';

export interface RankBadgeProps {
  rank: number;
}

function getRankPalette(rank: number) {
  if (rank === 1) return rankingColors.rank.top1;
  if (rank === 2) return rankingColors.rank.top2;
  if (rank === 3) return rankingColors.rank.top3;
  return rankingColors.rank.default;
}

export function RankBadge({ rank }: RankBadgeProps) {
  const palette = getRankPalette(rank);

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]} accessibilityLabel={`${rank}위`}>
      <SText variant="caption" style={[styles.text, { color: palette.text }]}>{rank.toString().padStart(2, '0')}</SText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.xs,
    width: 34,
  },
  text: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
