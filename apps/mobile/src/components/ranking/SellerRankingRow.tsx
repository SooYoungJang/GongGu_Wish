import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { RankingThumbnail, SellerRanking } from '../../features/ranking/types';
import { formatCompactCount } from '../../features/ranking/types';
import { FollowButton } from './FollowButton';
import { RankBadge } from './RankBadge';
import { RankingTrendBadge } from './RankingTrendBadge';
import { ThumbnailStrip } from './ThumbnailStrip';

export interface SellerRankingRowProps {
  item: SellerRanking;
  onPress: (item: SellerRanking) => void;
  onPressThumbnail?: (thumbnail: RankingThumbnail, item: SellerRanking) => void;
  onToggleFollow: (item: SellerRanking) => void;
}

export function SellerRankingRow({ item, onPress, onPressThumbnail, onToggleFollow }: SellerRankingRowProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const accessibilityLabel = `${item.rank}위 ${item.displayName}, 진행 중인 공구 ${item.activeDealCount}개`;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View style={s.mainRow}>
        <View style={s.rankAvatarGroup}>
          <RankBadge rank={item.rank} />
          <View style={s.avatarCircle}>
            <SText variant="title" style={s.avatarText}>{item.displayName.charAt(0)}</SText>
          </View>
        </View>

        <View style={s.infoColumn}>
          <View style={s.nameRow}>
            <SText variant="body" style={s.sellerName} numberOfLines={1}>
              {item.displayName}
            </SText>
          </View>

          <SText variant="caption" style={s.metaText} numberOfLines={1}>
            @{item.username} · 공구 {item.activeDealCount}개
          </SText>
        </View>

        <View style={s.endColumn}>
          <RankingTrendBadge trend={item.trend} />
          <FollowButton
            isFollowing={item.isFollowing}
            sellerName={item.displayName}
            onFollow={() => onToggleFollow(item)}
          />
        </View>
      </View>

      {item.thumbnails.length > 0 ? (
        <ThumbnailStrip
          thumbnails={item.thumbnails}
          onPressThumbnail={
            onPressThumbnail
              ? (thumbnail) => onPressThumbnail(thumbnail, item)
              : undefined
          }
        />
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    avatarCircle: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 21,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    avatarText: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 0,
    },
    endColumn: {
      alignItems: 'flex-end',
      gap: spacing.xs,
      justifyContent: 'center',
    },
    infoColumn: {
      flex: 1,
      gap: spacing.xxs,
      justifyContent: 'center',
      minWidth: 0,
    },
    mainRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metaText: {
      color: colors.weak,
      fontWeight: '700',
      minWidth: 0,
      overflow: 'hidden',
    },
    nameRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      minWidth: 0,
    },
    pressed: {
      opacity: 0.72,
    },
    rankAvatarGroup: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    row: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 110,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    sellerName: {
      color: colors.text,
      flex: 1,
      fontWeight: '900',
      minWidth: 0,
    },
  });
}
