import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SText } from './ui/SText';

import { borderRadius, categoryColors, spacing } from '../design/tokens';
import type { CategoryColorName } from '../design/tokens';
import type { GroupBuy } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

type DealCardProps = {
  item: GroupBuy;
  category: CategoryColorName;
  onPress: () => void;
};

const CATEGORY_LABELS: Record<CategoryColorName, string> = {
  beauty: '뷰티',
  fashion: '패션',
  food: '푸드',
  lifestyle: '라이프',
  baby: '육아',
  digital: '디지털',
};

function formatDeadline(endDate: string | null) {
  if (!endDate) return '마감일 미정';
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return '마감일 확인 필요';

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  if (days <= 7) return `${days}일 남음`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 마감`;
}

export function DealCard({ item, category, onPress }: DealCardProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const token = categoryColors[category];
  const imageUrl = item.thumbnailUrl ?? item.mediaUrls?.[0] ?? null;
  const categoryLabel = CATEGORY_LABELS[category];

  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 상세 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={s.card}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={s.image} />
      ) : (
        <View style={[s.image, { backgroundColor: token.bg, borderColor: token.border }]}>
          <SText variant="cardTitle" style={[s.imageText, { color: token.text }]}>{categoryLabel.slice(0, 2)}</SText>
        </View>
      )}
      <SText variant="subtitle" numberOfLines={2} style={s.title}>{item.productName ?? '공동구매 상품'}</SText>
      <SText variant="caption" numberOfLines={1} style={s.brand}>{categoryLabel} · @{item.rawPost.influencer.instagramUsername}</SText>
      <SText variant="cardBrand" style={s.discount}>{item.discountInfo ?? '혜택 확인'}</SText>
      <SText variant="caption" style={s.deadline}>{formatDeadline(item.endDate)}</SText>
    </Pressable>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    card: {
      flexBasis: '47%',
      flexGrow: 1,
    },
    image: {
      alignItems: 'center',
      borderRadius: borderRadius.xl,
      justifyContent: 'center',
      minHeight: 120,
      resizeMode: 'cover',
      width: '100%',
      aspectRatio: 1,
    },
    imageText: { fontSize: 18, fontWeight: '800' },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    brand: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
    discount: { color: colors.accent, fontSize: 13, fontWeight: '800' },
    deadline: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  });
}
