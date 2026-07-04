import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

export interface RankBadgeProps {
  rank: number;
}

function getRankStyle(rank: number, colors: CommerceColorPalette) {
  if (rank === 1) return { backgroundColor: colors.accent, color: colors.inverse };
  if (rank === 2) return { backgroundColor: colors.text, color: colors.inverse };
  if (rank === 3) return { backgroundColor: colors.blueSoft, color: colors.blue };
  return { backgroundColor: colors.softBg, color: colors.muted };
}

export function RankBadge({ rank }: RankBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getRankStyle(rank, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]} accessibilityLabel={`${rank}위`}>
      <SText variant="caption" style={[styles.text, { color: palette.color }]}>{rank.toString().padStart(2, '0')}</SText>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      borderRadius: commerceRadius.lg,
      justifyContent: 'center',
      minHeight: 34,
      width: 34,
    },
    text: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: -0.2,
    },
  });
}
