/**
 * Commerce design system tokens.
 *
 * The shopping-style screens are based on a Cashwalk/Toss-like commerce UI:
 * broad white/dark canvas, soft rounded search fields, heavy Korean commerce
 * typography, bright pink-red deal badges, and low-contrast gray surfaces.
 *
 * Keep new non-detail screens on these tokens instead of hard-coded colors so
 * light/dark mode stay visually consistent across the React Native app.
 */
export const commerceLightColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  softBg: '#F3F5F8',
  panelBg: '#F8FAFC',
  cardBg: '#FFFFFF',
  promoBg: '#FFFBF5',
  promoText: '#111827',
  promoMuted: '#6B7280',
  elevated: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#EEF0F3',
  divider: '#F1F3F5',
  text: '#111827',
  muted: '#6B7280',
  weak: '#9CA3AF',
  disabled: '#D1D5DB',
  accent: '#F0445E',
  accentDark: '#E4334F',
  accentLight: '#FF6B82',
  accentSoft: '#FFF1F4',
  blue: '#2F80ED',
  blueSoft: '#EEF6FF',
  yellow: '#F6C343',
  success: '#12A150',
  successSoft: '#EAF8F0',
  warning: '#A16207',
  warningSoft: '#FFF7E6',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
  overlay: 'rgba(17, 24, 39, 0.46)',
  inverse: '#FFFFFF',
  tabInactive: '#374151',
  bottomBarBg: '#FFFFFF',
  bottomBarBorder: '#E5E7EB',
  skeleton: '#E5E7EB',
} as const;

export const commerceDarkColors = {
  bg: '#17181D',
  surface: '#1C1D23',
  softBg: '#2B2C34',
  panelBg: '#202128',
  cardBg: '#1C1D23',
  promoBg: '#FFFBF5',
  promoText: '#111827',
  promoMuted: '#6B7280',
  elevated: '#24252D',
  border: '#343641',
  borderLight: '#272932',
  divider: '#252731',
  text: '#F4F5F8',
  muted: '#B5B7C1',
  weak: '#7D808B',
  disabled: '#4B4E59',
  accent: '#FF4E6A',
  accentDark: '#F0445E',
  accentLight: '#FF7B90',
  accentSoft: '#3A2029',
  blue: '#5AA2FF',
  blueSoft: '#1F2B45',
  yellow: '#FFD36B',
  success: '#41D37E',
  successSoft: '#173425',
  warning: '#FFD166',
  warningSoft: '#3A2E19',
  error: '#FF6B6B',
  errorSoft: '#3A2020',
  overlay: 'rgba(0, 0, 0, 0.72)',
  inverse: '#FFFFFF',
  tabInactive: '#D8DAE2',
  bottomBarBg: '#17181D',
  bottomBarBorder: '#2B2D36',
  skeleton: '#2D303A',
} as const;

export const commerceColors = commerceLightColors;
export type CommerceColorPalette = typeof commerceLightColors;

export function getCommerceColors(isDark: boolean): CommerceColorPalette {
  return (isDark ? commerceDarkColors : commerceLightColors) as CommerceColorPalette;
}

export const commerceRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const commerceSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screen: 16,
  section: 34,
  cardGap: 12,
  tabBarHeight: 82,
} as const;

export const commerceTypography = {
  pageTitle: { fontSize: 22, fontWeight: '900' as const, lineHeight: 29, letterSpacing: -0.2 },
  sectionTitle: { fontSize: 20, fontWeight: '900' as const, lineHeight: 27, letterSpacing: -0.1 },
  tabLabel: { fontSize: 16, fontWeight: '900' as const, lineHeight: 21, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, fontWeight: '800' as const, lineHeight: 21, letterSpacing: 0 },
  meta: { fontSize: 12, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 0 },
  badge: { fontSize: 12, fontWeight: '900' as const, lineHeight: 16, letterSpacing: 0 },
} as const;

export const commerceShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
} as const;

export const commerceDarkShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 3,
} as const;
