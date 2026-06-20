import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, shadows, spacing } from '../../design/tokens';
import type { RankingThumbnail, SellerRanking } from '../../features/ranking/types';
import { formatCompactCount } from '../../features/ranking/types';
import { AdBadge } from './AdBadge';
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
  const accessibilityLabel = `${item.rank}위 ${item.displayName}, 진행 중인 공구 ${item.activeDealCount}개`;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.mainRow}>
        <View style={styles.rankAvatarGroup}>
          <RankBadge rank={item.rank} />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{item.displayName.charAt(0)}</Text>
          </View>
        </View>

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.displayName}>
              {item.displayName}
            </Text>
            {item.isSponsored ? <AdBadge /> : null}
          </View>

          <Text numberOfLines={1} style={styles.meta}>
            @{item.username} · 공구 {item.activeDealCount}개
            {typeof item.followerCount === 'number' ? ` · 팔로워 ${formatCompactCount(item.followerCount)}` : ''}
          </Text>
        </View>

        <View style={styles.endColumn}>
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

const styles = StyleSheet.create({
  avatarCircle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  displayName: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 0,
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
  meta: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: borderRadius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
});
