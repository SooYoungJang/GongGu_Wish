import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, categoryColors, colors, shadows, spacing } from '../design/tokens';
import type { CategoryColorName } from '../design/tokens';
import type { GroupBuy } from '../types';

type DealCardProps = {
  item: GroupBuy;
  category: CategoryColorName;
  onPress: () => void;
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
  const token = categoryColors[category];
  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 상세 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
    >
      <View style={[styles.image, { backgroundColor: token.bg, borderColor: token.border }]}>
        <Text style={[styles.imageText, { color: token.text }]}>{item.brandName?.slice(0, 2) ?? '공구'}</Text>
      </View>
      <Text numberOfLines={2} style={styles.title}>{item.productName ?? '공동구매 상품'}</Text>
      <Text numberOfLines={1} style={styles.brand}>{item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`}</Text>
      <Text style={styles.discount}>{item.discountInfo ?? '혜택 확인'}</Text>
      <Text style={styles.deadline}>{formatDeadline(item.endDate)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 236,
    padding: spacing.md,
    ...shadows.sm,
  },
  image: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 104,
  },
  imageText: { fontSize: 18, fontWeight: '800' },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  brand: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  discount: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  deadline: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
});
