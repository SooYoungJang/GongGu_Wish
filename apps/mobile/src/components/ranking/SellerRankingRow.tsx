import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { SellerRanking } from '../../features/ranking/types';
import { formatCompactCount } from '../../features/ranking/types';
import { FollowButton } from './FollowButton';
import { RankBadge } from './RankBadge';
import { RankingTrendBadge } from './RankingTrendBadge';
import { ThumbnailStrip } from './ThumbnailStrip';

export interface SellerRankingRowProps {
  item: SellerRanking;
  listIndex?: number;
  onPress: (item: SellerRanking) => void;
  onToggleFollow: (item: SellerRanking) => void;
}

export function SellerRankingRow({ item, listIndex, onPress, onToggleFollow }: SellerRankingRowProps) {
  const { colors, isDark } = useCommerceTheme();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  // Filtered lists can keep the server rank on an item while changing its
  // visible position. Card treatment follows the current list position so
  // the first three visible cards always share the same shape.
  const featured = listIndex == null ? item.rank <= 3 : listIndex < 3;
  const compact = width <= 360;
  const thumbnailSize = compact ? 64 : 72;
  const viewCount = item.followerCount == null ? '-' : formatCompactCount(item.followerCount);
  const savedCount = formatCompactCount(item.activeDealCount);
  const popularityScore = item.trustScore == null ? null : Math.round(item.trustScore);
  const accessibilityLabel = `${item.rank}위 ${item.displayName}, 조회 ${viewCount}, 저장 ${savedCount}`;

  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handleToggleFollow = useCallback(() => onToggleFollow(item), [item, onToggleFollow]);

  return (
    <View testID={`ranking-row-${item.rank}`} style={[s.row, featured ? s.featuredRow : s.standardRow]}>
      <Pressable
        accessibilityHint="공구 상세 보기"
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [s.mainAction, pressed && s.pressed]}
      >
        <View style={s.rankColumn}>
          <RankBadge rank={item.rank} />
          <RankingTrendBadge trend={item.trend} />
        </View>

        {item.thumbnails.length > 0 ? (
          <ThumbnailStrip maxVisible={1} size={thumbnailSize} thumbnails={item.thumbnails} />
        ) : (
          <View style={[s.thumbnailFallback, { height: thumbnailSize, width: thumbnailSize }]}>
            <SText variant="caption" style={s.thumbnailFallbackText}>
              {item.displayName.charAt(0)}
            </SText>
          </View>
        )}

        <View style={s.infoColumn}>
          <SText variant="body" style={s.sellerName} numberOfLines={2}>
            {item.displayName}
          </SText>

          <SText variant="caption" style={s.username} numberOfLines={1}>
            @{item.username}
          </SText>

          <SText variant="caption" style={s.metricText} numberOfLines={1}>
            조회 {viewCount} · 저장 {savedCount}
          </SText>

          {popularityScore != null ? (
            <SText variant="caption" style={s.popularityText}>
              인기지수 {popularityScore}
            </SText>
          ) : null}
        </View>
      </Pressable>

      <View style={s.actionColumn}>
        <FollowButton isFollowing={item.isFollowing} sellerName={item.displayName} onFollow={handleToggleFollow} />
      </View>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette, isDark: boolean) {
  return StyleSheet.create({
    actionColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    featuredRow: {
      backgroundColor: colors.panelBg,
      borderCurve: 'continuous',
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      elevation: 1,
      marginBottom: spacing.sm,
      minHeight: 122,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.08 : 0.04,
      shadowRadius: 8,
    },
    infoColumn: {
      flex: 1,
      gap: spacing.xxs,
      justifyContent: 'center',
      minWidth: 0,
    },
    mainAction: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minWidth: 0,
    },
    metricText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    popularityText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '900',
      lineHeight: 16,
    },
    pressed: {
      opacity: 0.72,
    },
    rankColumn: {
      alignItems: 'center',
      gap: spacing.xs,
      width: 34,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    sellerName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 20,
      minWidth: 0,
    },
    standardRow: {
      backgroundColor: colors.bg,
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      minHeight: 106,
    },
    thumbnailFallback: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderCurve: 'continuous',
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      justifyContent: 'center',
    },
    thumbnailFallbackText: {
      color: colors.muted,
      fontSize: 18,
      fontWeight: '900',
    },
    username: {
      color: colors.weak,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
  });
}
