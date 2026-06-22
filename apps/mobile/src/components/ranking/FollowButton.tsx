import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { SText } from '../ui/SText';
import { borderRadius, colors, rankingColors, spacing } from '../../design/tokens';

export interface FollowButtonProps {
  isFollowing: boolean;
  sellerName: string;
  onFollow?: () => void;
  onPress?: () => void;
}

export function FollowButton({ isFollowing, sellerName, onFollow, onPress }: FollowButtonProps) {
  const palette = isFollowing ? rankingColors.following.active : rankingColors.following.inactive;
  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onFollow?.();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityLabel={`${sellerName} ${isFollowing ? '팔로잉 해제' : '팔로우'}`}
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: isFollowing ? palette.bg : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <SText variant="badge" style={[styles.text, { color: palette.text }]}>{isFollowing ? '팔로잉' : '팔로우'}</SText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 62,
    paddingHorizontal: spacing.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
});
