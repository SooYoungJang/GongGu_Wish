import { useMemo } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fetchFeedPost } from '../api';
import { AppButton } from '../components/AppButton';
import { InstagramCard } from '../components/InstagramCard';
import { SText } from '../components/ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { FeedDetailScreenProps } from '../types';

function formatDateRange(openDate: string | null, closeDate: string | null): {
  label: string;
  isExpired: boolean;
} {
  if (!openDate && !closeDate) return { label: '기간 미정', isExpired: false };

  const fmt = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const now = new Date();

  if (closeDate) {
    const close = new Date(closeDate);
    if (close < now) {
      const range = openDate ? `${fmt(openDate)} ~ ${fmt(closeDate)}` : `~ ${fmt(closeDate)}`;
      return { label: `${range} (마감)`, isExpired: true };
    }
  }

  const range = openDate
    ? `${fmt(openDate)} ~ ${closeDate ? fmt(closeDate) : '상시'}`
    : `~ ${closeDate ? fmt(closeDate) : '미정'}`;

  return { label: range, isExpired: false };
}

function LoadingView({ s, colors }: { s: any; colors: ColorPalette }) {
  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <View style={s.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </SafeAreaView>
  );
}

function ErrorView({ s, navigation }: { s: any; navigation: any }) {
  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <View style={s.centered}>
        <SText variant="subtitle" style={{ fontSize: 16, marginBottom: spacing.lg }}>
          피드를 불러올 수 없습니다.
        </SText>
        <AppButton variant="secondary" onPress={() => navigation.goBack()}>
          뒤로 가기
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

export function FeedDetailScreen({ route, navigation }: FeedDetailScreenProps) {
  const { feedId } = route.params;
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { data: feed, isLoading, isError } = useQuery({
    queryKey: ['feed-post', feedId],
    queryFn: () => fetchFeedPost(feedId),
  });

  if (isLoading) return <LoadingView s={s} colors={colors} />;
  if (isError || !feed) return <ErrorView s={s} navigation={navigation} />;

  const isImage = feed.mediaType === 'IMAGE' || (!feed.mediaType && feed.mediaUrl);
  const isVideo = feed.mediaType === 'VIDEO';
  const dateInfo = formatDateRange(feed.openDate, feed.closeDate);

  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <ScrollView
        bounces={false}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Media Section ── */}
        {feed.mediaUrl ? (
          <View style={s.mediaContainer}>
            {isImage ? (
              <Image
                source={{ uri: feed.mediaUrl }}
                style={s.mediaImage}
                resizeMode="contain"
              />
            ) : null}
            {isVideo ? (
              <View style={s.videoPlaceholder}>
                <SText variant="body" style={{ fontSize: 48, color: colors.textInverse, marginBottom: spacing.sm }}>▶</SText>
                <SText variant="caption" style={{ fontSize: 14 }}>영상</SText>
              </View>
            ) : null}
            <View style={s.mediaTypeBadge}>
              <SText variant="caption" style={{ fontSize: 11, fontWeight: '700', color: colors.textInverse, letterSpacing: 1 }}>
                {isVideo ? 'VIDEO' : 'IMAGE'}
              </SText>
            </View>
          </View>
        ) : null}

        {/* ── Content Card ── */}
        <View style={s.contentSection}>
          <InstagramCard>
            {/* Account Name */}
            {feed.accountName ? (
              <SText variant="eyebrow" style={{ fontSize: 15, marginBottom: spacing.md }}>
                @{feed.accountName}
              </SText>
            ) : null}

            {/* Caption */}
            {feed.caption ? (
              <SText variant="body" style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 24, marginBottom: spacing.lg }}>
                {feed.caption}
              </SText>
            ) : null}

            {/* Date Range */}
            <View style={s.dateRow}>
              <SText variant="label" style={{ marginRight: spacing.md, width: 48 }}>일정</SText>
              <View style={s.dateValueRow}>
                <SText variant="body" style={[{ fontSize: 14 }, dateInfo.isExpired && { color: colors.error, textDecorationLine: 'line-through' }]}>
                  {dateInfo.label}
                </SText>
                {dateInfo.isExpired ? (
                  <View style={s.expiredBadge}>
                    <SText variant="caption" style={{ fontSize: 11, fontWeight: '700', color: colors.error }}>마감</SText>
                  </View>
                ) : null}
              </View>
            </View>

            {/* CTA Button */}
            {feed.linkUrl ? (
              <AppButton
                style={s.ctaButton}
                variant="accent"
                onPress={() => {
                  const url = feed.linkUrl;
                  if (url) {
                    void Linking.openURL(url);
                  }
                }}
              >
                공구 보기
              </AppButton>
            ) : null}
          </InstagramCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    centered: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: spacing['2xl'],
    },
    scrollContent: { paddingBottom: spacing['4xl'] },
    /* ── Media ── */
    mediaContainer: {
      backgroundColor: '#000',
      position: 'relative',
      width: '100%',
    },
    mediaImage: {
      aspectRatio: 1,
      width: '100%',
    },
    videoPlaceholder: {
      alignItems: 'center',
      aspectRatio: 16 / 9,
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
    },
    mediaTypeBadge: {
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      position: 'absolute',
      right: spacing.sm,
      top: spacing.sm,
    },
    /* ── Content ── */
    contentSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    dateRow: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      flexDirection: 'row',
      paddingTop: spacing.md,
    },
    dateValueRow: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
    },
    expiredBadge: {
      backgroundColor: colors.errorBg,
      borderRadius: borderRadius.full,
      marginLeft: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    ctaButton: {
      marginTop: spacing.lg,
    },
  });
}
