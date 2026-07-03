import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';

import { borderRadius, spacing } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { formatEndDate, getDaysRemaining } from '../../utils';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type MonthlyBannerCarouselProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
};

function bestVisual(item: GroupBuy) {
  return item.thumbnailUrl ?? (item.mediaType === 'IMAGE' ? item.mediaUrls?.[0] ?? null : null);
}

function isActiveMonthlyFeatured(item: GroupBuy) {
  const daysRemaining = getDaysRemaining(item.endDate);
  return item.isMonthlyFeatured === true && daysRemaining >= 0 && daysRemaining !== Infinity;
}

function compareMonthlyFeatured(a: GroupBuy, b: GroupBuy) {
  const aRank = a.monthlyFeaturedRank ?? Number.MAX_SAFE_INTEGER;
  const bRank = b.monthlyFeaturedRank ?? Number.MAX_SAFE_INTEGER;
  if (aRank !== bRank) return aRank - bRank;
  return getDaysRemaining(a.endDate) - getDaysRemaining(b.endDate);
}

function BannerCard({
  item,
  items,
  onPress,
  s,
  colors,
}: {
  item: GroupBuy;
  items: GroupBuy[];
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  colors: ColorPalette;
}) {
  const daysRemaining = getDaysRemaining(item.endDate);
  const deadlineLabel = formatEndDate(item.endDate);
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;
  const isExpired = daysRemaining < 0;
  const isOpenEnded = daysRemaining === Infinity;

  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 배너 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={s.featureCard}
    >
      <View style={s.featureHeader}>
        <View style={s.featureTitleBlock}>
          <SText variant="cardTitle" numberOfLines={2} style={s.bannerTitle}>
            {item.productName ?? '새 공동구매'}
          </SText>
          <SText variant="cardBrand" numberOfLines={1} style={s.bannerMeta}>
            {item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`} · {item.discountInfo ?? '혜택 확인'}
          </SText>
        </View>
        <View style={[
          s.deadlineBadge,
          isOpenEnded && s.openEndedBadge,
          isUrgent && !isOpenEnded && s.urgentBadge,
          isExpired && !isOpenEnded && s.expiredBadge,
        ]}>
          <SText variant="label" style={s.deadlineBadgeText}>
            {isOpenEnded ? '상시' : isExpired ? '마감' : isUrgent ? '마감 임박' : `${daysRemaining}일 남음`}
          </SText>
        </View>
      </View>

      <View style={s.summaryRow}>
        <SText variant="body" numberOfLines={2} style={s.summaryText}>
          {item.summary ?? '이 공동구매의 요약을 확인해보세요.'}
        </SText>
      </View>

      <View style={s.thumbnailRail}>
        {items.slice(0, 4).map((groupBuy) => {
          const visual = bestVisual(groupBuy);
          return (
            <View key={groupBuy.id} style={s.bannerThumb}>
              {visual ? (
                <Image source={{ uri: visual }} style={s.bannerThumbImage} />
              ) : (
                <View style={[s.bannerThumbFallback, { backgroundColor: colors.surfaceHover }]}>
                  <SText variant="caption" style={s.bannerThumbText}>
                    {(groupBuy.brandName ?? groupBuy.productName ?? '공구').slice(0, 2)}
                  </SText>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.footerRow}>
        <SText variant="caption" style={s.footerText}>
          마감 {deadlineLabel}
        </SText>
      </View>
    </Pressable>
  );
}

export function MonthlyBannerCarousel({ groupBuys, onPressDeal }: MonthlyBannerCarouselProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const featuredItems = useMemo(() => {
    return groupBuys.filter(isActiveMonthlyFeatured).sort(compareMonthlyFeatured);
  }, [groupBuys]);
  const featured = featuredItems[0];

  return (
    <View style={s.section}>
      <SText variant="cardTitle" style={s.sectionTitle}>이달의 공구</SText>
      {featured ? (
        <BannerCard
          item={featured}
          items={featuredItems}
          onPress={() => onPressDeal(featured)}
          s={s}
          colors={colors}
        />
      ) : (
        <View style={s.emptyCard}>
          <SText variant="body" style={s.emptyText}>이달의 공구를 준비 중입니다</SText>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    sectionTitle: { color: colors.textPrimary, fontSize: 23, fontWeight: '900', marginBottom: spacing.md },
    featureCard: {
      minHeight: 236,
      paddingVertical: 0,
    },
    featureHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    featureTitleBlock: { flex: 1 },
    bannerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
    bannerMeta: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
    deadlineBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      minHeight: 28,
      paddingHorizontal: spacing.md,
    },
    openEndedBadge: { backgroundColor: colors.surfaceHover },
    urgentBadge: { backgroundColor: colors.error },
    expiredBadge: { backgroundColor: colors.surfaceHover },
    deadlineBadgeText: { color: colors.textInverse, fontSize: 12, fontWeight: '800' },
    summaryRow: { marginBottom: spacing.md },
    summaryText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
    thumbnailRail: { flexDirection: 'row', gap: spacing.sm },
    bannerThumb: { borderRadius: borderRadius.lg, flex: 1, height: 80, overflow: 'hidden' },
    bannerThumbImage: { height: '100%', resizeMode: 'cover', width: '100%' },
    bannerThumbFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    bannerThumbText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    footerRow: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
    footerText: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
    emptyCard: {
      alignItems: 'center',
      minHeight: 120,
      justifyContent: 'center',
    },
    emptyText: { color: colors.textSecondary },
  });
}
