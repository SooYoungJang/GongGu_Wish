import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type GestureResponderEvent, useWindowDimensions } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { RankingThumbnail } from '../../features/ranking/types';

export interface ThumbnailStripProps {
  thumbnails: readonly RankingThumbnail[];
  maxVisible?: 1 | 2 | 3;
  size?: number;
  onPressThumbnail?: (thumbnail: RankingThumbnail) => void;
}

export function ThumbnailStrip({ thumbnails, maxVisible, size = 42, onPressThumbnail }: ThumbnailStripProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
    <View style={s.container} accessibilityLabel={`진행 중인 공구 썸네일 ${thumbnails.length}개`}>
      {visible.map((thumbnail, index) => {
        const content = (
          <View style={[s.thumbnail, { height: size, width: size }]}>
            {thumbnail.imageUrl ? (
              <Image source={{ uri: thumbnail.imageUrl }} style={s.image} resizeMode="cover" />
            ) : (
              <SText variant="caption" style={s.placeholderText} numberOfLines={1}>
                {thumbnail.label?.slice(0, 2) ?? '공구'}
              </SText>
            )}
            {index === visible.length - 1 && hiddenCount > 0 ? (
              <View style={s.moreOverlay}>
                <SText variant="caption" style={s.moreText}>
                  +{hiddenCount}
                </SText>
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

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
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
      color: colors.inverse,
      fontSize: 12,
      fontWeight: '900',
    },
    placeholderText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '900',
      paddingHorizontal: spacing.xs,
    },
    thumbnail: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.sm,
      borderCurve: 'continuous',
      borderWidth: 1,
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
}
