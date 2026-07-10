import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import { SText } from './ui/SText';
import { useTheme } from '../context/ThemeContext';

/**
 * Dark mode toggle for settings/AdminScreen.
 * Shows current mode and allows switching between light/dark/system.
 */
export function ThemeToggle() {
  const { themeMode, setThemeMode, colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <View style={s.optionRow}>
        {(['system', 'light', 'dark'] as const).map((mode) => (
          <Pressable
            accessibilityLabel={mode === 'system' ? '시스템' : mode === 'light' ? '라이트' : '다크'}
            accessibilityRole="radio"
            accessibilityState={{ selected: themeMode === mode }}
            key={mode}
            onPress={() => setThemeMode(mode)}
            style={[s.option, themeMode === mode && s.optionActive]}
          >
            <SText
              variant="caption"
              style={[s.optionText, themeMode === mode && s.optionTextActive]}
            >
              {mode === 'system' ? '시스템' : mode === 'light' ? '라이트' : '다크'}
            </SText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      paddingVertical: spacing.md,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      flex: 1,
      minHeight: 34,
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    optionActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    optionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    optionText: {
      color: colors.muted,
      fontWeight: '900',
    },
    optionTextActive: {
      color: colors.inverse,
    },
  });
}
