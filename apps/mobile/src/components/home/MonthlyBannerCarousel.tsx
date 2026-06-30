import { useMemo } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';

import { borderRadius, cardOverlayGradientStops, spacing } from '../../design/tokens';
import type { GroupBuy } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type MonthlyBannerCarouselProps = {
  groupBuys: GroupBuy[];
  onPressDeal: (groupBuy: GroupBuy) => void;
};

function BannerCard({ item, onPress, s }: { item: GroupBuy; onPress: () => void; s: any }) {
  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 배너 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={s.bannerCard}
    >
      <ImageBackground
        source={{ uri: item.rawPost.postUrl }}
        style={s.bannerImage}
        imageStyle={s.bannerImageRadius}
      >
        <View style={s.bannerOverlayTop} />
        <View style={s.bannerOverlayBottom}>
          <SText variant="eyebrow" style={s.bannerEyebrow}>이달의 공구</SText>
          <SText variant="cardTitle" style={s.bannerTitle}>{item.productName ?? '새 공동구매'}</SText>
          <SText variant="cardBrand" style={s.bannerMeta}>
            {item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`} · {item.discountInfo ?? '혜택 확인'}
          </SText>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

export function MonthlyBannerCarousel({ groupBuys, onPressDeal }: MonthlyBannerCarouselProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <View style={s.section}>
      <SText variant="cardTitle" style={s.sectionTitle}>이달의 공구</SText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bannerCarousel}>
        {groupBuys.slice(0, 4).map((item) => (
          <BannerCard key={item.id} item={item} onPress={() => onPressDeal(item)} s={s} />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    sectionTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.md },
    bannerCarousel: { gap: spacing.md, paddingRight: spacing.lg },
    bannerCard: { borderRadius: borderRadius['3xl'], minHeight: 176, minWidth: 292, overflow: 'hidden', ...shadows.md },
    bannerImage: { backgroundColor: colors.primaryBg, flex: 1, justifyContent: 'space-between', minHeight: 176 },
    bannerImageRadius: { borderRadius: borderRadius['3xl'] },
    bannerOverlayTop: { backgroundColor: cardOverlayGradientStops[0], flex: 1 },
    bannerOverlayBottom: { backgroundColor: cardOverlayGradientStops[2], padding: spacing.lg },
    bannerEyebrow: { color: colors.textInverse, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
    bannerTitle: { color: colors.textInverse, fontSize: 22, fontWeight: '800', marginBottom: spacing.xs },
    bannerMeta: { color: colors.textInverse, fontSize: 13, fontWeight: '600' },
  });
}
