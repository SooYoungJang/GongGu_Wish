import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent, useWindowDimensions } from 'react-native';

import { borderRadius, colors, spacing } from '../../design/tokens';
import type { RankingThumbnail } from '../../features/ranking/types';

export interface ThumbnailStripProps {
  thumbnails: readonly RankingThumbnail[];
  maxVisible?: 2 | 3;
  size?: number;
  onPressThumbnail?: (thumbnail: RankingThumbnail) => void;
}

export function ThumbnailStrip({ thumbnails, maxVisible, size = 42, onPressThumbnail }: ThumbnailStripProps) {
  const { width } = useWindowDimensions();
  const responsiveMaxVisible = maxVisible ?? (width <= 340 ? 2 : 3);
  const visible = thumbnails.slice(0, responsiveMaxVisible);
  const hiddenCount = Math.max(thumbnails.length - visible.length, 0);

  if (visible.length === 0) {
    return null;
  }

  const handleThumbnailPress = (event: GestureResponderEvent, thumbnail: RankingThumbnail) => {
    event.stopPropagation();
    onPressThumbnail?.(thumbnail);
  };

  return (
    <View style={styles.container} accessibilityLabel={`진행 중인 공구 썸네일 ${thumbnails.length}개`}>
      {visible.map((thumbnail, index) => {
        const content = (
          <View style={[styles.thumbnail, { height: size, width: size }]}>
            {thumbnail.imageUrl ? (
              <Image source={{ uri: thumbnail.imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <Text style={styles.placeholderText} numberOfLines={1}>
                {thumbnail.label?.slice(0, 2) ?? '공구'}
              </Text>
            )}
            {index === visible.length - 1 && hiddenCount > 0 ? (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+{hiddenCount}</Text>
              </View>
            ) : null}
          </View>
        );

        if (!onPressThumbnail) {
          return <View key={thumbnail.id}>{content}</View>;
        }

        return (
          <Pressable
            key={thumbnail.id}
            accessibilityLabel={`${thumbnail.label ?? '공구'} 상세 보기`}
            accessibilityRole="button"
            onPress={(event) => handleThumbnailPress(event, thumbnail)}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: colors.overlay,
    justifyContent: 'center',
  },
  moreText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '900',
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
