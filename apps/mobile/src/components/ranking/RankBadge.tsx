import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

const RANK_BADGE_SIZE = 34;

export interface RankBadgeProps {
  rank: number;
}

function getRankStyle(rank: number, colors: CommerceColorPalette) {
  if (rank === 1)
    return {
      backgroundColor: colors.yellow,
      color: colors.promoText,
    };
  if (rank === 2) return { backgroundColor: colors.weak, color: colors.promoText };
  if (rank === 3)
    return {
      backgroundColor: colors.accent,
      color: colors.promoText,
    };
  return {
    backgroundColor: 'transparent',
    color: colors.text,
  };
}

export function RankBadge({ rank }: RankBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getRankStyle(rank, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View
      accessibilityLabel={`${rank}위`}
      style={[styles.badge, { backgroundColor: palette.backgroundColor }]}
    >
      <SText
        numberOfLines={1}
        variant="caption"
        style={[styles.text, { color: palette.color }]}
      >
        {rank}
      </SText>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      aspectRatio: 1,
      borderRadius: commerceRadius.full,
      borderCurve: 'circular',
      justifyContent: 'center',
      minHeight: RANK_BADGE_SIZE,
      minWidth: RANK_BADGE_SIZE,
      overflow: 'hidden',
      paddingHorizontal: commerceSpacing.xs,
      paddingVertical: commerceSpacing.xs,
    },
    text: {
      fontSize: 13,
      fontWeight: '900',
      includeFontPadding: false,
      letterSpacing: 0,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
}
