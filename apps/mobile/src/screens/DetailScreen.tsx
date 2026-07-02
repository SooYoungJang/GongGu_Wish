import { useMemo } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { InfoRow } from '../components/InfoRow';
import { InstagramCard } from '../components/InstagramCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { SText } from '../components/ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { DetailScreenProps } from '../types';
import { formatEndDate, getDaysRemaining } from '../utils';

export function DetailScreen({ route }: DetailScreenProps) {
  const { groupBuy } = route.params;
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const deadlineLabel = formatEndDate(groupBuy.endDate);
  const daysRemaining = getDaysRemaining(groupBuy.endDate);
  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;

  // Collect all media URLs to display (carousel images + videos)
  const mediaUrls = groupBuy.mediaUrls?.length
    ? groupBuy.mediaUrls
    : groupBuy.thumbnailUrl
      ? [groupBuy.thumbnailUrl]
      : [];

  const handleShare = async () => {
    const productName = groupBuy.productName ?? '공동구매';
    const username = groupBuy.rawPost.influencer.instagramUsername;
    try {
      await Share.share({
        message: `${productName} (@${username})\n${groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl}`,
      });
    } catch {
      Alert.alert('오류', '공유에 실패했습니다.');
    }
  };

  const handleOpenLink = () => {
    const url = groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl;
    void Linking.openURL(url);
  };

  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Deadline badge */}
        {(groupBuy.endDate) && (
          <View style={[
            s.deadlineBadge,
            isExpired && s.deadlineExpired,
            isUrgent && !isExpired && s.deadlineUrgent,
          ]}>
            <SText variant="caption" style={s.deadlineText}>
              {isExpired ? '⏰ ' : isUrgent ? '🔥 ' : '📅 '}
              {deadlineLabel}
            </SText>
          </View>
        )}

        <InstagramCard>
          <ScreenHeader
            eyebrow={`@${groupBuy.rawPost.influencer.instagramUsername}`}
            title={groupBuy.productName ?? '제품명 미확인'}
          />

          {/* Media gallery — thumbnail/carousel images + video */}
          {mediaUrls.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.mediaGallery}
              contentContainerStyle={s.mediaGalleryContent}
            >
              {mediaUrls.map((url, index) => {
                const isVideo = groupBuy.mediaType === 'VIDEO' || url === groupBuy.videoUrl;
                return (
                  <Pressable
                    key={`${url}-${index}`}
                    onPress={() => void Linking.openURL(url)}
                    style={s.mediaItem}
                  >
                    <Image
                      source={{ uri: url }}
                      style={s.mediaImage}
                      resizeMode="cover"
                    />
                    {isVideo ? (
                      <View style={s.videoBadge}>
                        <SText variant="caption" style={s.videoBadgeText}>영상</SText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Discount highlight */}
          {groupBuy.discountInfo ? (
            <View style={s.discountHighlight}>
              <SText variant="cardTitle" style={s.discountText}>
                {groupBuy.discountInfo}
              </SText>
            </View>
          ) : null}

          {/* Info rows */}
          <InfoRow label="브랜드" value={groupBuy.brandName} />
          {groupBuy.discountInfo ? (
            <InfoRow label="할인/혜택" value={groupBuy.discountInfo} />
          ) : null}
          {groupBuy.startDate ? (
            <InfoRow label="시작일" value={groupBuy.startDate} />
          ) : null}
          <InfoRow label="마감" value={deadlineLabel} />
          {groupBuy.purchaseUrl ? (
            <InfoRow label="구매 링크" value={groupBuy.purchaseUrl} />
          ) : null}
          <InfoRow label="요약" value={groupBuy.summary} />

          {/* Action buttons */}
          <View style={s.actionArea}>
            <AppButton onPress={handleOpenLink} disabled={isExpired}>
              {isExpired ? '마감된 공구' : '구매 링크 열기'}
            </AppButton>
            <AppButton variant="secondary" onPress={handleShare}>
              공유하기
            </AppButton>
          </View>
        </InstagramCard>

        {/* Original post link */}
        <View style={s.postLinkSection}>
          <SText variant="caption" style={s.postLinkLabel}>원문 보기</SText>
          <SText variant="body" style={s.postLinkUrl} numberOfLines={1}>
            {groupBuy.rawPost.postUrl}
          </SText>
          <AppButton variant="secondary" onPress={handleOpenLink}>
            인스타그램에서 보기
          </AppButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing['4xl'],
    },
    mediaGallery: {
      marginBottom: spacing.lg,
    },
    mediaGalleryContent: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
    },
    mediaItem: {
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      width: 200,
      height: 200,
      backgroundColor: colors.surfaceHover,
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    videoBadge: {
      position: 'absolute',
      bottom: spacing.xs,
      right: spacing.xs,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    videoBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    deadlineBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryBg,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    deadlineUrgent: {
      backgroundColor: colors.errorBg,
    },
    deadlineExpired: {
      backgroundColor: colors.surfaceHover,
    },
    deadlineText: {
      fontWeight: '700',
      color: colors.primary,
    },
    discountHighlight: {
      backgroundColor: colors.primaryBg,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
    },
    discountText: {
      color: colors.primary,
      fontWeight: '800',
    },
    actionArea: {
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    postLinkSection: {
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    postLinkLabel: {
      color: colors.textTertiary,
    },
    postLinkUrl: {
      color: colors.textSecondary,
      fontSize: 12,
      maxWidth: 280,
    },
  });
}
