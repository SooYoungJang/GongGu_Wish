import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, shadows, spacing, typography } from '../../design/tokens';
import type { FeedPost } from '../../types';

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

function FeedCard({ item, onPress }: { item: FeedPost; onPress: () => void }) {
  const hasThumbnail = !!item.thumbnailUrl;
  const caption = item.caption ?? '';
  const accountName = item.accountName ?? '알 수 없음';

  return (
    <Pressable
      accessibilityLabel={`${caption || accountName} 피드 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.thumbnailContainer}>
        {hasThumbnail ? (
          <Image source={{ uri: item.thumbnailUrl! }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.caption}>
          {caption}
        </Text>
        <Text numberOfLines={1} style={styles.accountName}>
          {accountName}
        </Text>
      </View>
    </Pressable>
  );
}

export function FeedSection({ feedPosts, onPressFeed, isLoading, isError, onRetry }: FeedSectionProps) {
  // Loading state
  if (isLoading && feedPosts.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>피드</Text>
          <View style={styles.headerDot} />
        </View>
        <View style={styles.statusContainer}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.statusText}>피드를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (isError && feedPosts.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>피드</Text>
          <View style={styles.headerDot} />
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.statusText}>피드를 불러올 수 없습니다.</Text>
          {onRetry ? (
            <Pressable
              accessibilityLabel="피드 다시 불러오기"
              accessibilityRole="button"
              onPress={onRetry}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // Empty state
  if (feedPosts.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>피드</Text>
          <View style={styles.headerDot} />
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>등록된 피드가 없습니다.</Text>
        </View>
      </View>
    );
  }

  // Normal state: horizontal scroll of feed cards
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>피드</Text>
        <View style={styles.headerDot} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {feedPosts.map((item) => (
          <FeedCard key={item.id} item={item} onPress={() => onPressFeed(item)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
