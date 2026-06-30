import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import type { ImageStyle } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import type { HikerPostData, HikerStatus } from '../hooks/useHikerApi';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstagramPreviewProps {
  status: HikerStatus;
  data: HikerPostData | null;
  error: string | null;
  onRetry?: () => void;
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ s }: { s: ReturnType<typeof StyleSheet.create> }) {
  return (
    <View style={[s.card, s.emptyCard]}>
      <View style={s.emptyIcon}>
        <SText variant="caption" style={s.emptyIconText}>🔗</SText>
      </View>
      <SText variant="body" style={s.emptyTitle}>
        게시물을 입력하면 미리보기가 표시됩니다
      </SText>
      <SText variant="caption" style={s.emptySubtitle}>
        인스타그램 게시물 URL을 입력하면 이미지와 내용을 자동으로 불러옵니다
      </SText>
    </View>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton({ s }: { s: ReturnType<typeof StyleSheet.create> }) {
  return (
    <View style={s.card}>
      <View style={s.skeletonRow}>
        {/* Skeleton avatar */}
        <View style={[s.skeleton, s.skeletonAvatar]} />
        {/* Skeleton author + likes */}
        <View style={s.skeletonTextBlock}>
          <View style={[s.skeleton, s.skeletonLine, { width: '55%' }]} />
          <View style={[s.skeleton, s.skeletonLine, { width: '30%', marginTop: 6 }]} />
        </View>
      </View>
      {/* Skeleton image */}
      <View style={[s.skeleton, s.skeletonImage]} />
      {/* Skeleton caption */}
      <View style={[s.skeleton, s.skeletonLine, { width: '90%', marginTop: spacing.sm }]} />
      <View style={[s.skeleton, s.skeletonLine, { width: '65%', marginTop: 6 }]} />
    </View>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ s, error, onRetry }: { s: ReturnType<typeof StyleSheet.create>; error: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, s.errorCard]}>
      <View style={s.errorIcon}>
        <SText variant="caption" style={s.errorIconText}>⚠️</SText>
      </View>
      <SText variant="body" style={s.errorText}>
        {error}
      </SText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={s.retryButton} accessibilityRole="button">
          <SText variant="label" style={s.retryText}>다시 시도</SText>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Success state ───────────────────────────────────────────────────────────

function formatCount(count: number): string {
  if (count >= 1_0000) return `${(count / 1_0000).toFixed(1)}만`;  // Korean 만
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function SuccessState({ s, data }: { s: ReturnType<typeof StyleSheet.create>; data: HikerPostData }) {
  return (
    <View style={s.card}>
      {/* Author + Likes row */}
      <View style={s.authorRow}>
        <View style={s.authorBlock}>
          <View style={s.avatarPlaceholder}>
            <SText variant="caption" style={s.avatarText}>
              {data.authorName?.charAt(0) ?? data.authorUsername?.charAt(0) ?? '?'}
            </SText>
          </View>
          <View style={s.authorInfo}>
            <SText variant="label" style={s.authorName} numberOfLines={1}>
              {data.authorName ?? data.authorUsername ?? '알 수 없음'}
            </SText>
            {data.authorUsername ? (
              <SText variant="caption" style={s.authorHandle} numberOfLines={1}>
                @{data.authorUsername}
              </SText>
            ) : null}
          </View>
        </View>
        {data.likeCount != null ? (
          <View style={s.likeBadge}>
            <SText variant="caption" style={s.likeCount}>
              ♥ {formatCount(data.likeCount)}
            </SText>
          </View>
        ) : null}
      </View>

      {/* Image */}
      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={s.previewImage as ImageStyle}
          resizeMode="cover"
          accessibilityLabel={data.caption ?? 'Instagram 게시물 이미지'}
        />
      ) : null}

      {/* Caption */}
      {data.caption ? (
        <SText variant="cardSummary" style={s.caption} numberOfLines={3}>
          {data.caption}
        </SText>
      ) : null}

      {/* Posted date */}
      {data.postedAt ? (
        <SText variant="caption" style={s.date}>
          {new Date(data.postedAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </SText>
      ) : null}
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InstagramPreview({ status, data, error, onRetry }: InstagramPreviewProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  switch (status) {
    case 'idle':
      return <EmptyState s={s} />;
    case 'loading':
      return <LoadingSkeleton s={s} />;
    case 'error':
      return <ErrorState s={s} error={error ?? '알 수 없는 오류가 발생했습니다.'} onRetry={onRetry} />;
    case 'success':
      return data ? <SuccessState s={s} data={data} /> : <EmptyState s={s} />;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    // Card base
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing['2xl'],
    },

    // Empty state
    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      borderStyle: 'dashed',
    },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyIconText: {
      fontSize: 18,
    },
    emptyTitle: {
      textAlign: 'center',
      marginBottom: spacing.xs,
      color: colors.textSecondary,
    },
    emptySubtitle: {
      textAlign: 'center',
      color: colors.textTertiary,
      lineHeight: 18,
    },

    // Skeleton
    skeleton: {
      backgroundColor: colors.skeleton,
      borderRadius: borderRadius.sm,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    skeletonAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: spacing.sm,
    },
    skeletonTextBlock: {
      flex: 1,
    },
    skeletonLine: {
      height: 12,
      borderRadius: 6,
    },
    skeletonImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: borderRadius.md,
    },

    // Error state
    errorCard: {
      alignItems: 'center',
      paddingVertical: spacing['2xl'],
      backgroundColor: colors.errorBg,
      borderColor: colors.error,
    },
    errorIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    errorIconText: {
      fontSize: 18,
    },
    errorText: {
      textAlign: 'center',
      color: colors.error,
      marginBottom: spacing.md,
    },
    retryButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.error,
    },
    retryText: {
      color: colors.textInverse,
    },

    // Success state
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    authorBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      color: colors.textPrimary,
      marginBottom: 0,
    },
    authorHandle: {
      color: colors.textTertiary,
    },
    likeBadge: {
      backgroundColor: colors.primaryBg,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    likeCount: {
      color: colors.primary,
      fontWeight: '600',
    },
    previewImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.skeleton,
    },
    caption: {
      lineHeight: 20,
    },
    date: {
      marginTop: spacing.xs,
      color: colors.textTertiary,
    },
  });
}
