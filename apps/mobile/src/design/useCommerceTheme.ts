import { useMemo } from 'react';

import { useTheme } from '../context/ThemeContext';
import {
  commerceDarkShadow,
  commerceRadius,
  commerceShadow,
  commerceSpacing,
  commerceTypography,
  getCommerceColors,
} from './commerce';

export function useCommerceTheme() {
  const { isDark, themeMode, setThemeMode, toggleTheme } = useTheme();

  return useMemo(
    () => ({
      isDark,
      themeMode,
      setThemeMode,
      toggleTheme,
      colors: getCommerceColors(isDark),
      radius: commerceRadius,
      spacing: commerceSpacing,
      typography: commerceTypography,
      shadow: isDark ? commerceDarkShadow : commerceShadow,
    }),
    [isDark, setThemeMode, themeMode, toggleTheme],
  );
}
