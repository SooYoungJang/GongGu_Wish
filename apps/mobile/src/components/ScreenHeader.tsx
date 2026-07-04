import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, right, children }: ScreenHeaderProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.header}>
      <View style={s.topRow}>
        <View style={s.titleBlock}>
          {eyebrow ? (
            <View style={s.eyebrowPill}>
              <SText variant="caption" style={s.eyebrowText}>{eyebrow}</SText>
            </View>
          ) : null}
          <SText variant="cardTitle" style={s.title}>{title}</SText>
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      {subtitle ? <SText variant="subtitle" style={s.subtitle}>{subtitle}</SText> : null}
      {children}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    header: {
      marginBottom: 18,
    },
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    titleBlock: {
      flex: 1,
    },
    eyebrowPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      marginBottom: 7,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    eyebrowText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 14,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.2,
      lineHeight: 29,
      marginBottom: 0,
    },
    right: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginLeft: spacing.md,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 21,
      marginBottom: 0,
      marginTop: 6,
    },
  });
}
