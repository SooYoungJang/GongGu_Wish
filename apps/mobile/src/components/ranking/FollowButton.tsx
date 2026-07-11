import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

export interface FollowButtonProps {
  isFollowing: boolean;
  sellerName: string;
  onFollow?: () => void;
}

export function FollowButton({ isFollowing, sellerName, onFollow }: FollowButtonProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel={`${sellerName} ${isFollowing ? '알림 해제' : '알림'}`}
      accessibilityHint="공구 알림 설정을 변경합니다"
      accessibilityRole="button"
      onPress={onFollow}
      style={({ pressed }) => [s.button, isFollowing ? s.followingButton : s.followButton, pressed && s.pressed]}
    >
      <Ionicons color={colors.accent} name={isFollowing ? 'notifications' : 'notifications-outline'} size={20} />
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    followButton: {
      backgroundColor: 'transparent',
      borderColor: colors.accent,
    },
    followingButton: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentSoft,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
