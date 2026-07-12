/**
 * @gonggu/mobile — Design Tokens
 *
 * ★ Source of truth: @gonggu/shared/tokens ★
 *
 * This file exposes React Native-friendly values while delegating all
 * color, spacing, radius, elevation, typography, and motion decisions to
 * the shared cross-platform token package.
 *
 * Primary (v2 unified — Airbnb Rausch): oklch(0.66 0.231 17) (#ff385c)
 * Accent (Instagram pink): oklch(0.6 0.21 7) / #e1306c
 */

import {
  accent,
  animation as sharedAnimation,
  cardOverlayGradient,
  categoryPastel,
  colors as sharedColors,
  cta,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  neutral,
  oklchToCssRgba,
  oklchToHex,
  primary,
  ranking,
  rnShadows,
  status,
} from '@gonggu/shared/tokens';

// ─── Shared Color Palette (React Native hex values) ──────────────────────────
export const colors = {
  // Primary brand — unified with web via @gonggu/shared/tokens
  primary: oklchToHex(primary[500]),
  primaryLight: oklchToHex(primary[400]),
  primaryDark: oklchToHex(primary[600]),
  primaryBg: oklchToHex(primary[50]),

  // Instagram accent (pink/red) — unified with web
  accent: oklchToHex(accent[500]),
  accentLight: oklchToHex(accent[400]),
  accentBg: oklchToHex(accent[50]),

  // CTA purple — high-emphasis Home actions (additive; does not replace primary)
  ctaPurple: oklchToHex(cta.purple),
  ctaPurpleHover: oklchToHex(cta.purpleHover),
  ctaPurpleText: oklchToHex(cta.purpleText),
  ctaPurpleBg: oklchToHex(cta.purpleBg),

  // Category pastel tokens — domain chips and section backgrounds
  categoryBeautyBg: oklchToHex(categoryPastel.beauty.bg),
  categoryBeautyText: oklchToHex(categoryPastel.beauty.text),
  categoryBeautyBorder: oklchToHex(categoryPastel.beauty.border),
  categoryFashionBg: oklchToHex(categoryPastel.fashion.bg),
  categoryFashionText: oklchToHex(categoryPastel.fashion.text),
  categoryFashionBorder: oklchToHex(categoryPastel.fashion.border),
  categoryFoodBg: oklchToHex(categoryPastel.food.bg),
  categoryFoodText: oklchToHex(categoryPastel.food.text),
  categoryFoodBorder: oklchToHex(categoryPastel.food.border),
  categoryLifestyleBg: oklchToHex(categoryPastel.lifestyle.bg),
  categoryLifestyleText: oklchToHex(categoryPastel.lifestyle.text),
  categoryLifestyleBorder: oklchToHex(categoryPastel.lifestyle.border),
  categoryBabyBg: oklchToHex(categoryPastel.baby.bg),
  categoryBabyText: oklchToHex(categoryPastel.baby.text),
  categoryBabyBorder: oklchToHex(categoryPastel.baby.border),
  categoryDigitalBg: oklchToHex(categoryPastel.digital.bg),
  categoryDigitalText: oklchToHex(categoryPastel.digital.text),
  categoryDigitalBorder: oklchToHex(categoryPastel.digital.border),
  categoryHomeBg: oklchToHex(categoryPastel.home.bg),
  categoryHomeText: oklchToHex(categoryPastel.home.text),
  categoryHomeBorder: oklchToHex(categoryPastel.home.border),
  categoryKitchenBg: oklchToHex(categoryPastel.kitchen.bg),
  categoryKitchenText: oklchToHex(categoryPastel.kitchen.text),
  categoryKitchenBorder: oklchToHex(categoryPastel.kitchen.border),
  categoryElectronicsBg: oklchToHex(categoryPastel.electronics.bg),
  categoryElectronicsText: oklchToHex(categoryPastel.electronics.text),
  categoryElectronicsBorder: oklchToHex(categoryPastel.electronics.border),
  categoryPetBg: oklchToHex(categoryPastel.pet.bg),
  categoryPetText: oklchToHex(categoryPastel.pet.text),
  categoryPetBorder: oklchToHex(categoryPastel.pet.border),
  categoryAutoBg: oklchToHex(categoryPastel.auto.bg),
  categoryAutoText: oklchToHex(categoryPastel.auto.text),
  categoryAutoBorder: oklchToHex(categoryPastel.auto.border),
  categoryHobbyBg: oklchToHex(categoryPastel.hobby.bg),
  categoryHobbyText: oklchToHex(categoryPastel.hobby.text),
  categoryHobbyBorder: oklchToHex(categoryPastel.hobby.border),
  categorySportsBg: oklchToHex(categoryPastel.sports.bg),
  categorySportsText: oklchToHex(categoryPastel.sports.text),
  categorySportsBorder: oklchToHex(categoryPastel.sports.border),
  categoryStationeryBg: oklchToHex(categoryPastel.stationery.bg),
  categoryStationeryText: oklchToHex(categoryPastel.stationery.text),
  categoryStationeryBorder: oklchToHex(categoryPastel.stationery.border),
  categoryBooksBg: oklchToHex(categoryPastel.books.bg),
  categoryBooksText: oklchToHex(categoryPastel.books.text),
  categoryBooksBorder: oklchToHex(categoryPastel.books.border),
  categoryMediaBg: oklchToHex(categoryPastel.media.bg),
  categoryMediaText: oklchToHex(categoryPastel.media.text),
  categoryMediaBorder: oklchToHex(categoryPastel.media.border),
  categoryTravelBg: oklchToHex(categoryPastel.travel.bg),
  categoryTravelText: oklchToHex(categoryPastel.travel.text),
  categoryTravelBorder: oklchToHex(categoryPastel.travel.border),

  // Card overlay gradient stops — for LinearGradient over media cards
  cardOverlayTop: oklchToCssRgba(cardOverlayGradient.top),
  cardOverlayMiddle: oklchToCssRgba(cardOverlayGradient.middle),
  cardOverlayBottom: oklchToCssRgba(cardOverlayGradient.bottom),

  // Backgrounds
  bg: oklchToHex(sharedColors.surface.secondary),
  surface: oklchToHex(sharedColors.surface.primary),
  surfaceHover: oklchToHex(sharedColors.surface.tertiary),

  // Text
  textPrimary: oklchToHex(sharedColors.text.primary),
  textSecondary: oklchToHex(sharedColors.text.secondary),
  textTertiary: oklchToHex(sharedColors.text.tertiary),
  textInverse: oklchToHex(sharedColors.text.inverse),
  textLink: oklchToHex(primary[500]),

  // Borders & dividers
  border: oklchToHex(sharedColors.border.primary),
  borderLight: oklchToHex(neutral[100]),
  divider: oklchToHex(neutral[100]),

  // Feedback
  success: oklchToHex(sharedColors.success[500]),
  successBg: oklchToHex(sharedColors.success[50]),
  warning: oklchToHex(sharedColors.warning[500]),
  warningBg: oklchToHex(sharedColors.warning[50]),
  error: oklchToHex(sharedColors.error[500]),
  errorBg: oklchToHex(sharedColors.error[50]),

  // Status-specific colors
  statusPendingBg: oklchToHex(status.pending.bg),
  statusPendingText: oklchToHex(status.pending.text),
  statusPendingBorder: oklchToHex(status.pending.border),
  statusApprovedBg: oklchToHex(status.approved.bg),
  statusApprovedText: oklchToHex(status.approved.text),
  statusApprovedBorder: oklchToHex(status.approved.border),
  statusRejectedBg: oklchToHex(status.rejected.bg),
  statusRejectedText: oklchToHex(status.rejected.text),
  statusRejectedBorder: oklchToHex(status.rejected.border),
  statusReviewBg: oklchToHex(status.review.bg),
  statusReviewText: oklchToHex(status.review.text),
  statusReviewBorder: oklchToHex(status.review.border),
  statusDuplicateBg: oklchToHex(status.duplicate.bg),
  statusDuplicateText: oklchToHex(status.duplicate.text),
  statusDuplicateBorder: oklchToHex(status.duplicate.border),

  // Ranking — additive namespace for Search tab rankings
  rankingTop1Bg: oklchToHex(ranking.rank.top1Bg),
  rankingTop1Text: oklchToHex(ranking.rank.top1Text),
  rankingTop2Bg: oklchToHex(ranking.rank.top2Bg),
  rankingTop2Text: oklchToHex(ranking.rank.top2Text),
  rankingTop3Bg: oklchToHex(ranking.rank.top3Bg),
  rankingTop3Text: oklchToHex(ranking.rank.top3Text),
  rankingDefaultBg: oklchToHex(ranking.rank.defaultBg),
  rankingDefaultText: oklchToHex(ranking.rank.defaultText),

  rankingAdBg: oklchToHex(ranking.ad.bg),
  rankingAdText: oklchToHex(ranking.ad.text),
  rankingAdBorder: oklchToHex(ranking.ad.border),

  rankingMovementUpText: oklchToHex(ranking.movement.upText),
  rankingMovementUpBg: oklchToHex(ranking.movement.upBg),
  rankingMovementDownText: oklchToHex(ranking.movement.downText),
  rankingMovementDownBg: oklchToHex(ranking.movement.downBg),
  rankingMovementSameText: oklchToHex(ranking.movement.sameText),
  rankingMovementSameBg: oklchToHex(ranking.movement.sameBg),
  rankingMovementNewText: oklchToHex(ranking.movement.newText),
  rankingMovementNewBg: oklchToHex(ranking.movement.newBg),

  rankingFollowingActiveBg: oklchToHex(ranking.following.activeBg),
  rankingFollowingActiveText: oklchToHex(ranking.following.activeText),
  rankingFollowingInactiveBg: oklchToHex(ranking.following.inactiveBg),
  rankingFollowingInactiveText: oklchToHex(ranking.following.inactiveText),

  // Misc
  skeleton: oklchToHex(neutral[200]),
  shadow: '#000000',
  overlay: oklchToCssRgba(sharedColors.overlay.backdrop),
  badgeBg: oklchToHex(status.review.bg),
  badgeText: oklchToHex(primary[600]),
  noticeText: oklchToHex('oklch(0.47 0.12 48)'),  // deep amber for notice boxes
} as const;

export const categoryColors = {
  beauty: {
    bg: colors.categoryBeautyBg,
    text: colors.categoryBeautyText,
    border: colors.categoryBeautyBorder,
  },
  fashion: {
    bg: colors.categoryFashionBg,
    text: colors.categoryFashionText,
    border: colors.categoryFashionBorder,
  },
  food: {
    bg: colors.categoryFoodBg,
    text: colors.categoryFoodText,
    border: colors.categoryFoodBorder,
  },
  baby: {
    bg: colors.categoryBabyBg,
    text: colors.categoryBabyText,
    border: colors.categoryBabyBorder,
  },
  living: {
    bg: colors.categoryLifestyleBg,
    text: colors.categoryLifestyleText,
    border: colors.categoryLifestyleBorder,
  },
  // Legacy API category kept render-safe while records migrate to `living`.
  lifestyle: {
    bg: colors.categoryLifestyleBg,
    text: colors.categoryLifestyleText,
    border: colors.categoryLifestyleBorder,
  },
  home: {
    bg: colors.categoryHomeBg,
    text: colors.categoryHomeText,
    border: colors.categoryHomeBorder,
  },
  kitchen: {
    bg: colors.categoryKitchenBg,
    text: colors.categoryKitchenText,
    border: colors.categoryKitchenBorder,
  },
  electronics: {
    bg: colors.categoryElectronicsBg,
    text: colors.categoryElectronicsText,
    border: colors.categoryElectronicsBorder,
  },
  // Legacy API category kept render-safe while records migrate to `electronics`.
  digital: {
    bg: colors.categoryDigitalBg,
    text: colors.categoryDigitalText,
    border: colors.categoryDigitalBorder,
  },
  pet: {
    bg: colors.categoryPetBg,
    text: colors.categoryPetText,
    border: colors.categoryPetBorder,
  },
  auto: {
    bg: colors.categoryAutoBg,
    text: colors.categoryAutoText,
    border: colors.categoryAutoBorder,
  },
  hobby: {
    bg: colors.categoryHobbyBg,
    text: colors.categoryHobbyText,
    border: colors.categoryHobbyBorder,
  },
  sports: {
    bg: colors.categorySportsBg,
    text: colors.categorySportsText,
    border: colors.categorySportsBorder,
  },
  stationery: {
    bg: colors.categoryStationeryBg,
    text: colors.categoryStationeryText,
    border: colors.categoryStationeryBorder,
  },
  books: {
    bg: colors.categoryBooksBg,
    text: colors.categoryBooksText,
    border: colors.categoryBooksBorder,
  },
  media: {
    bg: colors.categoryMediaBg,
    text: colors.categoryMediaText,
    border: colors.categoryMediaBorder,
  },
  travel: {
    bg: colors.categoryTravelBg,
    text: colors.categoryTravelText,
    border: colors.categoryTravelBorder,
  },
} as const;

export type CategoryColorName = keyof typeof categoryColors;

export const rankingColors = {
  rank: {
    top1: { bg: colors.rankingTop1Bg, text: colors.rankingTop1Text },
    top2: { bg: colors.rankingTop2Bg, text: colors.rankingTop2Text },
    top3: { bg: colors.rankingTop3Bg, text: colors.rankingTop3Text },
    default: { bg: colors.rankingDefaultBg, text: colors.rankingDefaultText },
  },
  ad: {
    bg: colors.rankingAdBg,
    text: colors.rankingAdText,
    border: colors.rankingAdBorder,
  },
  movement: {
    up: { bg: colors.rankingMovementUpBg, text: colors.rankingMovementUpText },
    down: { bg: colors.rankingMovementDownBg, text: colors.rankingMovementDownText },
    same: { bg: colors.rankingMovementSameBg, text: colors.rankingMovementSameText },
    new: { bg: colors.rankingMovementNewBg, text: colors.rankingMovementNewText },
  },
  following: {
    active: { bg: colors.rankingFollowingActiveBg, text: colors.rankingFollowingActiveText },
    inactive: { bg: colors.rankingFollowingInactiveBg, text: colors.rankingFollowingInactiveText },
  },
} as const;

export type RankingMovementColorName = keyof typeof rankingColors.movement;

export const cardOverlayGradientStops = [
  colors.cardOverlayTop,
  colors.cardOverlayMiddle,
  colors.cardOverlayBottom,
] as const;

// ─── Spacing Scale (8px grid, with 4px micro step) ──────────────────────────
export const spacing = {
  /** 2px — legacy micro step */
  xxs: 2,
  /** 4px */
  xs: mobileSpacing('1'),
  /** 8px */
  sm: mobileSpacing('2'),
  /** 12px */
  md: mobileSpacing('3'),
  /** 16px — standard card padding */
  lg: mobileSpacing('4'),
  /** 20px */
  xl: mobileSpacing('5'),
  /** 24px — section spacing */
  '2xl': mobileSpacing('6'),
  /** 32px */
  '3xl': mobileSpacing('8'),
  /** 48px */
  '4xl': mobileSpacing('12'),
} as const;

// ─── Border Radius ──────────────────────────────────────────────
export const borderRadius = {
  /** 8px — inputs, small elements */
  sm: mobileRadius('sm'),
  /** 16px — default card radius (V4: 10px→16px) */
  md: 16,
  /** 12px — primary buttons */
  lg: mobileRadius('lg'),
  /** 16px — cards */
  xl: mobileRadius('xl'),
  /** 24px — feature/feed cards */
  '2xl': mobileRadius('2xl'),
  /** 28px — premium banner cards */
  '3xl': mobileRadius('3xl'),
  /** 999px — pills, badges */
  full: mobileRadius('full'),
} as const;

// ─── Shadows (React Native style) ───────────────────────────────────────
export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const shadows: Record<'sm' | 'md' | 'lg', ShadowStyle> = {
  /** Subtle card shadow */
  sm: rnShadows.sm,
  /** Standard card shadow */
  md: rnShadows.card,
  /** Modal / overlay shadow */
  lg: rnShadows.lg,
};

// ─── Typography ─────────────────────────────────────────────────
export const typography = {
  eyebrow: {
    fontSize: mobileFontSize('xs'),
    fontWeight: '600' as const,
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: mobileFontSize('3xl'),
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: mobileFontSize('lg'),
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardBrand: {
    fontSize: mobileFontSize('sm'),
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardSummary: {
    fontSize: mobileFontSize('sm'),
    color: oklchToHex(neutral[600]),
    lineHeight: 20,
  },
  body: {
    fontSize: mobileFontSize('sm'),
    color: colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: mobileFontSize('sm'),
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: mobileFontSize('xs'),
    color: colors.textTertiary,
  },
  badge: {
    fontSize: mobileFontSize('xs'),
    fontWeight: '600' as const,
    color: colors.badgeText,
  },
  button: {
    fontSize: mobileFontSize('base'),
    fontWeight: '600' as const,
    color: colors.textInverse,
  },
};

// ─── Animation / Motion ─────────────────────────────────────────
export const animation = {
  duration: sharedAnimation.durations,
  easing: sharedAnimation.easings,
} as const;

// ─── NativeWind-Compatible ClassName Fragments ─────────────────
// These strings remain for compatibility with existing NativeWind usage.
// Color values are resolved from shared tokens at module load time.
export const tw = {
  card: 'bg-neutral-0 rounded-2xl p-4 mb-3 border border-neutral-100 shadow-sm',
  primaryButton: `mt-6 py-3.5 bg-[${colors.primary}] rounded-xl items-center`,
  secondaryButton: 'py-2.5 px-4 bg-neutral-100 rounded-xl self-start',
  primaryButtonText: 'text-base font-semibold text-white',
  secondaryButtonText: 'text-sm font-semibold text-neutral-700',
  input: 'border border-neutral-300 rounded-xl px-3 py-2.5 text-sm text-neutral-900 bg-neutral-0',
  notice: 'p-3 bg-warning-100 rounded-lg mb-4',
  noticeText: 'text-xs text-warning-800 text-center',
  badge: `text-xs font-semibold text-[${colors.badgeText}] bg-primary-50 px-2 py-1 rounded-full`,
  headerTitle: `text-3xl font-bold text-[${colors.textPrimary}] mb-1`,
  headerSubtitle: 'text-sm text-neutral-500 leading-5 mb-4',
  eyebrow: `text-xs font-semibold text-[${colors.primary}] tracking-wide mb-1`,
} as const;
