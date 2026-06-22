import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SText } from './ui/SText';
import { colors, spacing, typography } from '../design/tokens';

type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, right, children }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <SText variant="eyebrow">{eyebrow}</SText>
          <SText variant="title">{title}</SText>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? <SText variant="subtitle" style={styles.subtitle}>{subtitle}</SText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing['2xl'],
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  right: {
    marginLeft: spacing.md,
  },
  eyebrow: typography.eyebrow,
  title: typography.title,
  subtitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
});
