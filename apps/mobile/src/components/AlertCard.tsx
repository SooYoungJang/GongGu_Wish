import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SText } from './ui/SText';

import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { GroupBuy } from '../types';
import { formatEndDate } from '../utils';

type AlertCardProps = {
  item: GroupBuy;
  onPress: () => void;
};

export function AlertCard({ item, onPress }: AlertCardProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const brandLabel = item.brandName ?? '브랜드 미확인';
  const discountLabel = item.discountInfo ?? '혜택 확인 필요';
  const deadlineLabel = formatEndDate(item.endDate);
  const confidencePercent = Math.round(item.confidence * 100);
  const influencerUsername = item.rawPost.influencer.instagramUsername;

  return (
    <Pressable testID={`alert-card-${item.id}`} onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <View style={s.brandBadge}>
        <SText variant="caption" style={s.brandBadgeEyebrow}>BRAND</SText>
        <SText variant="caption" style={s.brandBadgeText} numberOfLines={2}>{brandLabel}</SText>
      </View>

      <View style={s.info}>
        <View style={s.topRow}>
          <SText variant="caption" style={s.influencerName} numberOfLines={1}>@{influencerUsername}</SText>
          <View style={s.deadlinePill}>
            <SText variant="caption" style={s.deadlineText}>{deadlineLabel}</SText>
          </View>
        </View>

        <SText variant="cardTitle" style={s.productName} numberOfLines={1}>{item.productName ?? '제품명 미확인'}</SText>

        <View style={s.discountRow}>
          <SText variant="caption" style={s.discount} numberOfLines={1}>{discountLabel}</SText>
          <View style={s.confidenceBadge}>
            <SText variant="caption" style={s.confidenceText}>신뢰도 {confidencePercent}%</SText>
          </View>
        </View>

        {item.summary ? <SText variant="caption" style={s.summary} numberOfLines={2}>{item.summary}</SText> : null}
      </View>
    </Pressable>
  );
}

const BRAND_BADGE_SIZE = 76;

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    pressed: { opacity: 0.78 },
    brandBadge: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      justifyContent: 'center',
      marginRight: spacing.md,
      minHeight: BRAND_BADGE_SIZE,
      padding: spacing.sm,
      width: BRAND_BADGE_SIZE,
    },
    brandBadgeEyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
      lineHeight: 12,
      marginBottom: spacing.xxs,
    },
    brandBadgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 16,
      textAlign: 'center',
    },
    info: { flex: 1 },
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    influencerName: { color: colors.muted, flex: 1, fontSize: 12, fontWeight: '800' },
    productName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 21,
      marginBottom: spacing.xxs,
    },
    discountRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    discount: { color: colors.accent, flex: 1, fontSize: 13, fontWeight: '900', lineHeight: 17 },
    deadlinePill: {
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    deadlineText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
    confidenceBadge: {
      backgroundColor: colors.blueSoft,
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    confidenceText: { color: colors.blue, fontSize: 11, fontWeight: '900' },
    summary: { color: colors.weak, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  });
}
