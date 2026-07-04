import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { RankingTrend } from '../../features/ranking/types';

export interface RankingTrendBadgeProps {
  trend: RankingTrend;
}

function getTrendStyle(trend: RankingTrend, colors: CommerceColorPalette) {
  switch (trend.kind) {
    case 'up':
      return { label: `▲${trend.delta}`, bg: colors.accentSoft, text: colors.accent };
    case 'down':
      return { label: `▼${trend.delta}`, bg: colors.blueSoft, text: colors.blue };
    case 'new':
      return { label: 'NEW', bg: colors.successSoft, text: colors.success };
    default:
      return { label: '―', bg: colors.softBg, text: colors.weak };
  }
}

export function RankingTrendBadge({ trend }: RankingTrendBadgeProps) {
  const { colors } = useCommerceTheme();
  const palette = getTrendStyle(trend, colors);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <SText variant="caption" style={[styles.text, { color: palette.text }]}>{palette.label}</SText>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 24,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
    },
    text: {
      fontSize: 11,
      fontWeight: '900',
    },
  });
}
