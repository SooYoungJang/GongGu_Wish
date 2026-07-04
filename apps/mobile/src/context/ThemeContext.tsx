import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, shadows } from '../design/tokens';
import { colorsDark, shadowsDark } from '../design/tokensDark';
import { getCommerceColors, type CommerceColorPalette } from '../design/commerce';
import type { ShadowStyle } from '../design/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = '@gonggu/theme_mode';

// ─── Types ────────────────────────────────────────────────────────────────────

type BaseColorPalette = typeof colors;
export type ColorPalette = Omit<BaseColorPalette, keyof CommerceColorPalette> & CommerceColorPalette;
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeContextValue {
  /** Whether dark mode is currently active (resolved from system + user preference) */
  isDark: boolean;
  /** The user's theme preference setting */
  themeMode: ThemeMode;
  /** Set theme mode: 'system' follows device, 'light'/'dark' overrides */
  setThemeMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (preserves override) */
  toggleTheme: () => void;
  /** Active color palette based on current theme */
  colors: ColorPalette;
  /** Active shadows based on current theme */
  shadows: Record<'sm' | 'md' | 'lg', ShadowStyle>;
  /** True while restoring saved theme preference on mount */
  isRestoring: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore saved theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      })
      .finally(() => {
        setIsRestoring(false);
      });
  }, []);

  // Persist theme mode preference when it changes
  useEffect(() => {
    if (!isRestoring) {
      AsyncStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
  }, [themeMode, isRestoring]);

  // Determine if dark mode is active
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  // Resolved color and shadow palettes. The shared tokens are extended with
  // the commerce semantic aliases so all existing and redesigned screens can
  // read one theme object while light/dark mode stays in sync.
  const [activeColors, activeShadows] = useMemo(() => {
    const baseColors = isDark ? colorsDark : colors;
    const commerce = getCommerceColors(isDark);
    const mergedColors = {
      ...baseColors,
      ...commerce,
      primary: commerce.accent,
      primaryLight: commerce.accentLight,
      primaryDark: commerce.accentDark,
      primaryBg: commerce.accentSoft,
      accent: commerce.accent,
      accentLight: commerce.accentLight,
      accentBg: commerce.accentSoft,
      bg: commerce.bg,
      surface: commerce.surface,
      surfaceHover: commerce.softBg,
      textPrimary: commerce.text,
      textSecondary: commerce.muted,
      textTertiary: commerce.weak,
      textInverse: commerce.inverse,
      textLink: commerce.blue,
      border: commerce.border,
      borderLight: commerce.borderLight,
      divider: commerce.divider,
      success: commerce.success,
      successBg: commerce.successSoft,
      warning: commerce.warning,
      warningBg: commerce.warningSoft,
      error: commerce.error,
      errorBg: commerce.errorSoft,
      skeleton: commerce.skeleton,
      shadow: '#000000',
      overlay: commerce.overlay,
      badgeBg: commerce.accentSoft,
      badgeText: commerce.accent,
      noticeText: commerce.warning,
    } as ColorPalette;

    return [mergedColors, isDark ? shadowsDark : shadows];
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setThemeModeState(isDark ? 'light' : 'dark');
  }, [isDark]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      themeMode,
      setThemeMode,
      toggleTheme,
      colors: activeColors,
      shadows: activeShadows,
      isRestoring,
    }),
    [isDark, themeMode, setThemeMode, toggleTheme, activeColors, activeShadows, isRestoring],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
