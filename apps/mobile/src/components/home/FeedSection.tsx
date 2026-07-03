import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SText } from '../../components/ui/SText';
import { borderRadius, spacing, typography } from '../../design/tokens';
import type { FeedPost } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type FeedSectionProps = {
  feedPosts: FeedPost[];
  onPressFeed: (feedPost: FeedPost) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

function FeedCard({ item, onPress, s }: { item: FeedPost; onPress: () => void; s: any }) {
  const imageUrl = item.ogImage ?? item.thumbnailUrl ?? (item.mediaType === 'IMAGE' ? item.mediaUrl : null);
  const title = item.ogTitle ?? item.caption ?? '';
  const description = item.ogDescription ?? '';
  const accountName = item.accountName ?? '알 수 없음';

  return (
    <Pressable
      accessibilityLabel={`${title || accountName} 피드 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={s.card}
    >
      <View style={s.thumbnailContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.thumbnail} />
        ) : (
          <View style={s.placeholder}>
            <SText variant="body" style={s.placeholderIcon}>📷</SText>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <SText variant="cardBrand" numberOfLines={2} style={s.caption}>
          {title || '새로운 피드'}
        </SText>
        {description ? (
          <SText variant="caption" numberOfLines={2} style={s.description}>
            {description}
          </SText>
        ) : null}
        <SText variant="caption" numberOfLines={1} style={s.accountName}>
          @{accountName}
        </SText>
      </View>
    </Pressable>
  );
}

export function FeedSection({ feedPosts, onPressFeed, isLoading, isError, onRetry }: FeedSectionProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  if (isLoading && feedPosts.length === 0) {
    return (
      <View style={s.section}>
        <View style={s.headerRow}>
          <SText variant="cardTitle" style={s.sectionTitle}>피드</SText>
          <View style={s.headerDot} />
        </View>
        <View style={s.statusContainer}>
          <ActivityIndicator color={colors.primary} size="small" />
          <SText variant="body" style={s.statusText}>피드를 불러오는 중...</SText>
        </View>
      </View>
    );
  }

  if (isError && feedPosts.length === 0) {
    return (
      <View style={s.section}>
        <View style={s.headerRow}>
          <SText variant="cardTitle" style={s.sectionTitle}>피드</SText>
          <View style={s.headerDot} />
        </View>
        <View style={s.statusContainer}>
          <SText variant="body" style={s.errorIcon}>⚠️</SText>
          <SText variant="body" style={s.statusText}>피드를 불러올 수 없습니다.</SText>
          {onRetry ? (
            <Pressable
              accessibilityLabel="피드 다시 불러오기"
              accessibilityRole="button"
              onPress={onRetry}
              style={s.retryButton}
            >
              <SText variant="label" style={s.retryText}>다시 시도</SText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (feedPosts.length === 0) {
    return (
      <View style={s.section}>
        <View style={s.headerRow}>
          <SText variant="cardTitle" style={s.sectionTitle}>피드</SText>
          <View style={s.headerDot} />
        </View>
        <View style={s.statusContainer}>
          <SText variant="body" style={s.statusText}>등록된 피드가 없습니다.</SText>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <SText variant="cardTitle" style={s.sectionTitle}>피드</SText>
        <View style={s.headerDot} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {feedPosts.map((item) => (
          <FeedCard key={item.id} item={item} onPress={() => onPressFeed(item)} s={s} />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xl },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    sectionTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    headerDot: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      height: 8,
      marginLeft: spacing.sm,
      width: 8,
    },
    scrollContent: { gap: spacing.sm, paddingRight: spacing.lg },
    card: {
      backgroundColor: 'transparent',
      minHeight: 44,
      width: 128,
    },
    thumbnailContainer: {
      backgroundColor: colors.primaryBg,
      borderRadius: borderRadius.lg,
      height: 128,
      overflow: 'hidden',
      position: 'relative',
    },
    thumbnail: { height: '100%', resizeMode: 'cover', width: '100%' },
    placeholder: { alignItems: 'center', height: '100%', justifyContent: 'center' },
    placeholderIcon: { fontSize: 32 },
    cardBody: { paddingTop: spacing.xs, width: 128 },
    caption: {
      ...typography.cardBrand,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      marginBottom: 2,
    },
    description: { ...typography.caption, color: colors.textTertiary, fontSize: 11, marginBottom: 2 },
    accountName: { ...typography.caption, color: colors.textTertiary, fontSize: 11 },
    statusContainer: {
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    statusText: { color: colors.textSecondary, fontSize: 14 },
    errorIcon: { fontSize: 28 },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    retryText: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  });
}
