import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import type { CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <SText variant="label" style={s.infoLabel}>{label}</SText>
      <SText variant="body" style={s.infoValue}>{value}</SText>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    infoRow: {
      borderBottomColor: colors.borderLight,
      borderBottomWidth: 1,
      flexDirection: 'row',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
    },
    infoLabel: {
      color: colors.weak,
      fontSize: 13,
      fontWeight: '900',
      width: 86,
    },
    infoValue: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
  });
}
