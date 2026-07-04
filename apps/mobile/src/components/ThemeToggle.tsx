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
  const { isDark, themeMode, toggleTheme, setThemeMode, colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <SText variant="label" style={s.title}>화면 모드</SText>
        <Pressable
          onPress={toggleTheme}
          style={s.toggle}
          accessibilityRole="switch"
          accessibilityLabel={isDark ? '다크 모드 켜짐' : '다크 모드 꺼짐'}
        >
          <SText variant="label" style={s.toggleText}>
            {isDark ? '다크 모드' : '라이트 모드'}
          </SText>
        </Pressable>
      </View>

      <View style={s.optionRow}>
        {(['system', 'light', 'dark'] as const).map((mode) => (
          <Pressable
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
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
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
    title: {
      color: colors.text,
      fontWeight: '900',
    },
    toggle: {
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    toggleText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '900',
    },
  });
}
