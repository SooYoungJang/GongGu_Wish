import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import type { ImageStyle } from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { HikerPostData, HikerStatus } from '../hooks/useHikerApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstagramPreviewProps {
  status: HikerStatus;
  data: HikerPostData | null;
  error: string | null;
  onRetry?: () => void;
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[s.card, s.emptyCard]}>
      <View style={s.emptyIcon}>
        <SText variant="caption" style={s.emptyIconText}>↗</SText>
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

function LoadingSkeleton({ s, colors }: { s: ReturnType<typeof makeStyles>; colors: CommerceColorPalette }) {
  return (
    <View style={s.card}>
      <View style={s.loadingTopRow}>
        <ActivityIndicator color={colors.accent} size="small" />
        <SText variant="label" style={s.loadingText}>게시물을 불러오는 중…</SText>
      </View>
      <View style={s.skeletonRow}>
        <View style={[s.skeleton, s.skeletonAvatar]} />
        <View style={s.skeletonTextBlock}>
          <View style={[s.skeleton, s.skeletonLine, { width: '55%' }]} />
          <View style={[s.skeleton, s.skeletonLine, { width: '30%', marginTop: 6 }]} />
        </View>
      </View>
      <View style={[s.skeleton, s.skeletonImage]} />
      <View style={[s.skeleton, s.skeletonLine, { width: '90%', marginTop: spacing.sm }]} />
      <View style={[s.skeleton, s.skeletonLine, { width: '65%', marginTop: 6 }]} />
    </View>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ s, error, onRetry }: { s: ReturnType<typeof makeStyles>; error: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, s.errorCard]}>
      <View style={s.errorIcon}>
        <SText variant="caption" style={s.errorIconText}>!</SText>
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
  if (count >= 1_0000) return `${(count / 1_0000).toFixed(1)}만`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function SuccessState({ s, data }: { s: ReturnType<typeof makeStyles>; data: HikerPostData }) {
  return (
    <View style={s.card}>
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

      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={s.previewImage as ImageStyle}
          resizeMode="cover"
          accessibilityLabel={data.caption ?? 'Instagram 게시물 이미지'}
        />
      ) : null}

      {data.caption ? (
        <SText variant="cardSummary" style={s.caption} numberOfLines={3}>
          {data.caption}
        </SText>
      ) : null}

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
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  switch (status) {
    case 'idle':
      return <EmptyState s={s} />;
    case 'loading':
      return <LoadingSkeleton s={s} colors={colors} />;
    case 'error':
      return <ErrorState s={s} error={error ?? '알 수 없는 오류가 발생했습니다.'} onRetry={onRetry} />;
    case 'success':
      return data ? <SuccessState s={s} data={data} /> : <EmptyState s={s} />;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    authorBlock: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
    },
    authorHandle: {
      color: colors.weak,
      fontWeight: '700',
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      color: colors.text,
      fontWeight: '900',
      marginBottom: 0,
    },
    authorRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      height: 36,
      justifyContent: 'center',
      marginRight: spacing.sm,
      width: 36,
    },
    avatarText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '900',
    },
    caption: {
      color: colors.muted,
      fontWeight: '600',
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      marginBottom: spacing['2xl'],
      padding: spacing.lg,
    },
    date: {
      color: colors.weak,
      marginTop: spacing.xs,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderStyle: 'dashed',
      paddingVertical: spacing['3xl'],
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      height: 42,
      justifyContent: 'center',
      marginBottom: spacing.sm,
      width: 42,
    },
    emptyIconText: {
      color: colors.accent,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 26,
    },
    emptySubtitle: {
      color: colors.weak,
      fontWeight: '600',
      lineHeight: 18,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.text,
      fontWeight: '900',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    errorCard: {
      alignItems: 'center',
      backgroundColor: colors.errorSoft,
      borderColor: colors.error,
      paddingVertical: spacing['2xl'],
    },
    errorIcon: {
      alignItems: 'center',
      backgroundColor: colors.error,
      borderRadius: commerceRadius.full,
      height: 40,
      justifyContent: 'center',
      marginBottom: spacing.sm,
      width: 40,
    },
    errorIconText: {
      color: colors.inverse,
      fontSize: 18,
      fontWeight: '900',
    },
    errorText: {
      color: colors.error,
      fontWeight: '800',
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    likeBadge: {
      backgroundColor: colors.accentSoft,
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    likeCount: {
      color: colors.accent,
      fontWeight: '900',
    },
    loadingText: {
      color: colors.muted,
      fontWeight: '800',
    },
    loadingTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    previewImage: {
      aspectRatio: 1,
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.lg,
      marginBottom: spacing.sm,
      width: '100%',
    },
    retryButton: {
      backgroundColor: colors.error,
      borderRadius: commerceRadius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    retryText: {
      color: colors.inverse,
      fontWeight: '900',
    },
    skeleton: {
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.sm,
    },
    skeletonAvatar: {
      borderRadius: commerceRadius.full,
      height: 36,
      marginRight: spacing.sm,
      width: 36,
    },
    skeletonImage: {
      aspectRatio: 1,
      borderRadius: commerceRadius.lg,
      width: '100%',
    },
    skeletonLine: {
      borderRadius: commerceRadius.full,
      height: 12,
    },
    skeletonRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    skeletonTextBlock: {
      flex: 1,
    },
  });
}
