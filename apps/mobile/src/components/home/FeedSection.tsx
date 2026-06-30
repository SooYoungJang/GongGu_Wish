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
  /** Loading state — shown when true and no feedPosts available */
  isLoading?: boolean;
  /** Error state — shown when true and no feedPosts available */
  isError?: boolean;
  /** Called when user taps retry after an error */
  onRetry?: () => void;
};

function FeedCard({ item, onPress, s, colors }: { item: FeedPost; onPress: () => void; s: any; colors: ColorPalette }) {
  const ogImage = item.ogImage ?? item.thumbnailUrl;
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
        {ogImage ? (
          <Image source={{ uri: ogImage }} style={s.thumbnail} />
        ) : (
          <View style={s.placeholder}>
            <SText variant="body" style={s.placeholderIcon}>📷</SText>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <SText variant="cardBrand" numberOfLines={2} style={s.caption}>
          {title}
        </SText>
        {description ? (
          <SText variant="caption" numberOfLines={2} style={s.description}>
            {description}
          </SText>
        ) : null}
        <SText variant="caption" numberOfLines={1} style={s.accountName}>
          {accountName}
        </SText>
      </View>
    </Pressable>
  );
}

export function FeedSection({ feedPosts, onPressFeed, isLoading, isError, onRetry }: FeedSectionProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Loading state
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

  // Error state
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

  // Empty state
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

  // Normal state: horizontal scroll of feed cards
  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <SText variant="cardTitle" style={s.sectionTitle}>피드</SText>
        <View style={s.headerDot} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {feedPosts.map((item) => (
          <FeedCard key={item.id} item={item} onPress={() => onPressFeed(item)} s={s} colors={colors} />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: {
      marginBottom: spacing.xl,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    headerDot: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      height: 8,
      marginLeft: spacing.sm,
      width: 8,
    },
    scrollContent: {
      gap: spacing.md,
      paddingRight: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      width: 148,
    },
    thumbnailContainer: {
      backgroundColor: colors.primaryBg,
      height: 148,
      overflow: 'hidden',
    },
    thumbnail: {
      height: '100%',
      resizeMode: 'cover',
      width: '100%',
    },
    placeholder: {
      alignItems: 'center',
      height: '100%',
      justifyContent: 'center',
    },
    placeholderIcon: {
      fontSize: 32,
    },
    cardBody: {
      padding: spacing.sm,
    },
    caption: {
      ...typography.cardBrand,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      marginBottom: 2,
    },
    description: {
      ...typography.caption,
      color: colors.textTertiary,
      fontSize: 11,
      marginBottom: 2,
    },
    accountName: {
      ...typography.caption,
      color: colors.textTertiary,
      fontSize: 11,
    },
    statusContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      gap: spacing.sm,
      padding: spacing.xl,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    errorIcon: {
      fontSize: 28,
    },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    retryText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
