import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, right, children }: ScreenHeaderProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <View style={s.header}>
      <View style={s.topRow}>
        <View style={s.titleBlock}>
          {eyebrow ? <SText variant="eyebrow">{eyebrow}</SText> : null}
          <SText variant="cardTitle" style={s.title}>{title}</SText>
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      {subtitle ? <SText variant="subtitle" style={s.subtitle}>{subtitle}</SText> : null}
      {children}
    </View>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    header: {
      marginBottom: spacing.lg,
    },
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    right: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginLeft: spacing.md,
    },
    subtitle: {
      lineHeight: 22,
      marginTop: spacing.xs,
    },
  });
}
