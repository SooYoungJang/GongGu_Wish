import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InstagramIdentity } from './ui/InstagramIdentity';
import { InstagramProfileAvatar } from './ui/InstagramProfileAvatar';
import { SText } from './ui/SText';

import { borderRadius, spacing } from '../design/tokens';
import type { Influencer } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

type InfluencerCardProps = {
  influencer: Influencer;
  onPress: () => void;
};

export function InfluencerCard({ influencer, onPress }: InfluencerCardProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const displayName = influencer.displayName?.trim() || null;
  const avatarLabel = displayName ?? influencer.instagramUsername;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${avatarLabel} 선택`}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <InstagramProfileAvatar
        profileImageUrl={influencer.profileImageUrl}
        size={44}
        style={s.avatar}
        username={influencer.instagramUsername}
      />
      <View style={s.info}>
        {displayName ? (
          <SText variant="cardTitle" style={s.displayName} numberOfLines={1}>
            {displayName}
          </SText>
        ) : null}
        <InstagramIdentity
          showAvatar={false}
          size={displayName ? "compact" : "body"}
          textStyle={[s.username, !displayName && s.usernamePrimary]}
          username={influencer.instagramUsername}
        />
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: spacing.sm,
      padding: spacing.md,
      ...shadows.sm,
    },
    pressed: { opacity: 0.82 },
    avatar: {
      marginRight: spacing.md,
    },
    info: { flex: 1 },
    displayName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    username: { fontSize: 12, fontWeight: '600' },
    usernamePrimary: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  });
}
