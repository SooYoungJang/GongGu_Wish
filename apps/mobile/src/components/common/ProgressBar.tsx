import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { borderRadius } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type ProgressBarProps = {
  /** 0–100 progress value */
  progress: number;
  /** Bar height (default: 6) */
  height?: number;
};

export function ProgressBar({ progress, height = 6 }: ProgressBarProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors, height), [colors, height]);
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${clamped}%` as any}]} />
    </View>
  );
}

function makeStyles(colors: ColorPalette, height: number) {
  return StyleSheet.create({
    track: {
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      height,
      overflow: 'hidden',
      width: '100%',
    },
    fill: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      height: '100%',
    },
  });
}
