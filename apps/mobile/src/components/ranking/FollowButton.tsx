import { useMemo } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

export interface FollowButtonProps {
  isFollowing: boolean;
  sellerName: string;
  onFollow?: () => void;
  onPress?: () => void;
}

export function FollowButton({ isFollowing, sellerName, onFollow, onPress }: FollowButtonProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
        s.button,
        isFollowing ? s.followingButton : s.followButton,
        pressed && s.pressed,
      ]}
    >
      <SText variant="badge" style={[s.text, isFollowing ? s.followingText : s.followText]}>
        {isFollowing ? '팔로잉' : '팔로우'}
      </SText>
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 62,
      paddingHorizontal: spacing.sm,
    },
    followButton: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    followingButton: {
      backgroundColor: colors.softBg,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.72,
    },
    text: {
      fontSize: 12,
      fontWeight: '900',
    },
    followText: {
      color: colors.inverse,
    },
    followingText: {
      color: colors.muted,
    },
  });
}
