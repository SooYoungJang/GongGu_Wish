import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

export interface RankBadgeProps {
  rank: number;
}

function getRankStyle(rank: number, colors: CommerceColorPalette) {
  if (rank === 1)
    return {
      backgroundColor: colors.yellow,
      color: colors.promoText,
      featured: true,
    };
  if (rank === 2) return { backgroundColor: colors.weak, color: colors.promoText, featured: true };
  if (rank === 3)
    return {
      backgroundColor: colors.warning,
      color: colors.promoText,
      featured: true,
    };
  return {
    backgroundColor: 'transparent',
    color: colors.text,
    featured: false,
  };
}

export function RankBadge({ rank }: RankBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getRankStyle(rank, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View
      accessibilityLabel={`${rank}위`}
      style={[styles.badge, !palette.featured && styles.plainBadge, { backgroundColor: palette.backgroundColor }]}
    >
      <SText variant="caption" style={[styles.text, { color: palette.color }]}>
        {rank}
      </SText>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderCurve: 'continuous',
      justifyContent: 'center',
      height: 34,
      width: 34,
    },
    plainBadge: {
      height: 28,
    },
    text: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0,
    },
  });
}
