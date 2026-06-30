/**
 * @gonggu/mobile — Dark Mode Design Tokens (V4 Premium Beige)
 *
 * ★ V4 Dark Mode Palette ★
 * Maps every light-mode token to its dark-mode equivalent.
 * Warm beige hue (80) maintained across both modes for visual continuity.
 *
 * V4 Dark Spec:
 *   surface.primary:  oklch(0.14 0.025 80) — #1f1a15  screen bg
 *   surface.secondary: oklch(0.17 0.03 80)  — #28221c  card bg
 *   text.primary:      oklch(0.93 0.01 80)  — #e8e0d8
 *   text.secondary:    oklch(0.75 0.01 80)
 *   primary:           oklch(0.72 0.22 17)  — #ff6b81  (+6% L vs light)
 *
 * Contrast (vs darkest bg oklch(0.14 0.025 80)):
 *   text.primary:   15.5:1 ✅
 *   text.secondary:  7.8:1 ✅
 *   text.tertiary:   4.5:1 ✅
 */

import { oklchToHex, oklchToCssRgba } from '@gonggu/shared/tokens';
import type { ShadowStyle } from './tokens';
import { shadows } from './tokens';

// ─── Dark Mode Colour Palette (Warm Beige) ────────────────────────────────────

export const colorsDark = {
  // Primary brand — coral, +6% L for dark bg readability (unchanged from V3)
  primary: oklchToHex('oklch(0.72 0.22 17)'),       // #ff6b81
  primaryLight: oklchToHex('oklch(0.78 0.16 17)'),   // #ff8fa3
  primaryDark: oklchToHex('oklch(0.64 0.22 17)'),    // #e84057
  primaryBg: oklchToHex('oklch(0.24 0.06 17)'),      // dark coral tint

  // Accent — Instagram pink, +7% L
  accent: oklchToHex('oklch(0.67 0.19 7)'),          // #f06a93
  accentLight: oklchToHex('oklch(0.74 0.16 7)'),     // #f592b0
  accentBg: oklchToHex('oklch(0.23 0.06 355)'),

  // CTA purple
  ctaPurple: oklchToHex('oklch(0.64 0.20 300)'),
  ctaPurpleHover: oklchToHex('oklch(0.58 0.21 300)'),
  ctaPurpleText: oklchToHex('oklch(1 0 0)'),
  ctaPurpleBg: oklchToHex('oklch(0.22 0.07 300)'),

  // Backgrounds — warm dark beige (hue 80)
  bg: oklchToHex('oklch(0.14 0.025 80)'),             // #1f1a15 — screen bg
  surface: oklchToHex('oklch(0.17 0.03 80)'),          // #28221c — card bg
  surfaceHover: oklchToHex('oklch(0.20 0.03 80)'),     // slightly lighter for hover

  // Text — warm light on warm dark
  textPrimary: oklchToHex('oklch(0.93 0.01 80)'),     // #e8e0d8
  textSecondary: oklchToHex('oklch(0.75 0.01 80)'),
  textTertiary: oklchToHex('oklch(0.55 0.01 80)'),
  textInverse: oklchToHex('oklch(0.14 0.025 80)'),    // #1f1a15
  textLink: oklchToHex('oklch(0.72 0.22 17)'),         // matches primary

  // Borders & dividers — warm dark borders
  border: oklchToHex('oklch(0.28 0.025 80)'),          // #372f27
  borderLight: oklchToHex('oklch(0.22 0.025 80)'),     // light border
  divider: oklchToHex('oklch(0.22 0.025 80)'),         // same as borderLight

  // Feedback — adjusted L for dark bg
  success: oklchToHex('oklch(0.72 0.20 142)'),        // #4ade80
  successBg: oklchToHex('oklch(0.22 0.06 142)'),
  warning: oklchToHex('oklch(0.78 0.18 85)'),         // #fbbf24
  warningBg: oklchToHex('oklch(0.22 0.04 85)'),
  error: oklchToHex('oklch(0.68 0.20 25)'),           // #f87171
  errorBg: oklchToHex('oklch(0.20 0.05 25)'),

  // Status-specific badges (hue preserved, luminance adjusted for dark bg)
  statusPendingBg: oklchToHex('oklch(0.22 0.05 90)'),
  statusPendingText: oklchToHex('oklch(0.78 0.15 90)'),
  statusPendingBorder: oklchToHex('oklch(0.35 0.08 90)'),
  statusApprovedBg: oklchToHex('oklch(0.20 0.06 142)'),
  statusApprovedText: oklchToHex('oklch(0.72 0.18 142)'),
  statusApprovedBorder: oklchToHex('oklch(0.32 0.10 142)'),
  statusRejectedBg: oklchToHex('oklch(0.20 0.05 25)'),
  statusRejectedText: oklchToHex('oklch(0.68 0.18 25)'),
  statusRejectedBorder: oklchToHex('oklch(0.32 0.08 25)'),
  statusReviewBg: oklchToHex('oklch(0.20 0.06 260)'),
  statusReviewText: oklchToHex('oklch(0.68 0.18 260)'),
  statusReviewBorder: oklchToHex('oklch(0.32 0.09 260)'),
  statusDuplicateBg: oklchToHex('oklch(0.22 0.02 80)'),
  statusDuplicateText: oklchToHex('oklch(0.68 0.02 80)'),
  statusDuplicateBorder: oklchToHex('oklch(0.32 0.02 80)'),

  // Category pastels (dark mode inverted)
  categoryBeautyBg: oklchToHex('oklch(0.22 0.05 350)'),
  categoryBeautyText: oklchToHex('oklch(0.65 0.10 350)'),
  categoryBeautyBorder: oklchToHex('oklch(0.35 0.06 350)'),
  categoryFashionBg: oklchToHex('oklch(0.21 0.05 285)'),
  categoryFashionText: oklchToHex('oklch(0.62 0.10 285)'),
  categoryFashionBorder: oklchToHex('oklch(0.33 0.06 285)'),
  categoryFoodBg: oklchToHex('oklch(0.23 0.05 85)'),
  categoryFoodText: oklchToHex('oklch(0.65 0.08 85)'),
  categoryFoodBorder: oklchToHex('oklch(0.35 0.06 85)'),
  categoryLifestyleBg: oklchToHex('oklch(0.22 0.04 185)'),
  categoryLifestyleText: oklchToHex('oklch(0.62 0.08 185)'),
  categoryLifestyleBorder: oklchToHex('oklch(0.34 0.05 185)'),
  categoryBabyBg: oklchToHex('oklch(0.23 0.04 145)'),
  categoryBabyText: oklchToHex('oklch(0.62 0.09 145)'),
  categoryBabyBorder: oklchToHex('oklch(0.35 0.05 145)'),
  categoryDigitalBg: oklchToHex('oklch(0.21 0.04 250)'),
  categoryDigitalText: oklchToHex('oklch(0.62 0.09 250)'),
  categoryDigitalBorder: oklchToHex('oklch(0.33 0.05 250)'),

  // Ranking (dark mode)
  rankingTop1Bg: oklchToHex('oklch(0.24 0.06 88)'),
  rankingTop1Text: oklchToHex('oklch(0.72 0.13 78)'),
  rankingTop2Bg: oklchToHex('oklch(0.22 0.03 250)'),
  rankingTop2Text: oklchToHex('oklch(0.65 0.04 250)'),
  rankingTop3Bg: oklchToHex('oklch(0.23 0.05 55)'),
  rankingTop3Text: oklchToHex('oklch(0.68 0.10 55)'),
  rankingDefaultBg: oklchToHex('oklch(0.20 0.02 80)'),
  rankingDefaultText: oklchToHex('oklch(0.60 0.03 80)'),

  rankingAdBg: oklchToHex('oklch(0.21 0.04 260)'),
  rankingAdText: oklchToHex('oklch(0.62 0.12 260)'),
  rankingAdBorder: oklchToHex('oklch(0.32 0.06 260)'),

  rankingMovementUpBg: oklchToHex('oklch(0.22 0.05 142)'),
  rankingMovementUpText: oklchToHex('oklch(0.72 0.18 142)'),
  rankingMovementDownBg: oklchToHex('oklch(0.22 0.04 25)'),
  rankingMovementDownText: oklchToHex('oklch(0.68 0.16 25)'),
  rankingMovementSameBg: oklchToHex('oklch(0.20 0.02 80)'),
  rankingMovementSameText: oklchToHex('oklch(0.60 0.02 80)'),
  rankingMovementNewBg: oklchToHex('oklch(0.22 0.05 260)'),
  rankingMovementNewText: oklchToHex('oklch(0.68 0.16 260)'),

  rankingFollowingActiveBg: oklchToHex('oklch(0.22 0.05 355)'),
  rankingFollowingActiveText: oklchToHex('oklch(0.68 0.18 355)'),
  rankingFollowingInactiveBg: oklchToHex('oklch(0.17 0.03 80)'),
  rankingFollowingInactiveText: oklchToHex('oklch(0.65 0.02 80)'),

  // Misc
  skeleton: oklchToHex('oklch(0.25 0.03 80)'),
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  badgeBg: oklchToHex('oklch(0.20 0.06 260)'),
  badgeText: oklchToHex('oklch(0.72 0.18 17)'),
  noticeText: oklchToHex('oklch(0.75 0.14 48)'),

  // Card overlay gradients (applied over media, not bg — unchanged)
  cardOverlayTop: 'rgba(0, 0, 0, 0)',
  cardOverlayMiddle: 'rgba(0, 0, 0, 0.18)',
  cardOverlayBottom: 'rgba(0, 0, 0, 0.62)',
} as const;

// ─── Dark Mode Shadows ────────────────────────────────────────────────────────

export const shadowsDark: Record<'sm' | 'md' | 'lg', ShadowStyle> = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 5,
  },
};

export type DarkColorKey = keyof typeof colorsDark;
