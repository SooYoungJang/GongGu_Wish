import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SText } from '../ui/SText';
import { ScreenHeader } from '../ScreenHeader';
import { SearchGlyph } from '../ui/LineGlyphs';

import { borderRadius, spacing } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type HomeHeaderProps = {
  onOpenBookmarks: () => void;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
};

export function HomeHeader({ onOpenBookmarks, onOpenNotifications, onOpenSearch }: HomeHeaderProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <ScreenHeader
      title="공구위시"
      right={
        <View style={s.actions}>
          <Pressable
            accessibilityLabel="검색"
            accessibilityRole="button"
            onPress={onOpenSearch}
            style={s.iconButton}
          >
            <SearchGlyph color={colors.textPrimary} size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel="북마크 열기"
            accessibilityRole="button"
            onPress={onOpenBookmarks}
            style={s.iconButton}
          >
            <SText variant="cardTitle" style={s.bookmarkIcon}>⌑</SText>
          </Pressable>
          <Pressable
            accessibilityLabel="알림 열기"
            accessibilityRole="button"
            onPress={onOpenNotifications}
            style={[s.iconButton, s.bellButton]}
          >
            <View style={s.bellIcon}>
              <View style={s.bellCap} />
              <View style={s.bellBody} />
              <View style={s.bellClapper} />
            </View>
            <View style={s.notificationDot} />
          </Pressable>
        </View>
      }
    />
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    bookmarkIcon: { color: colors.textSecondary, fontSize: 18, fontWeight: '800' },
    bellButton: {
      position: 'relative',
    },
    bellIcon: {
      alignItems: 'center',
      height: 18,
      justifyContent: 'center',
      position: 'relative',
      width: 18,
    },
    bellCap: {
      backgroundColor: colors.textPrimary,
      borderRadius: borderRadius.full,
      height: 2,
      position: 'absolute',
      top: 1,
      width: 4,
    },
    bellBody: {
      borderColor: colors.textPrimary,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 1.8,
      borderBottomWidth: 2.2,
      height: 11,
      left: 2,
      position: 'absolute',
      top: 3,
      width: 14,
    },
    bellClapper: {
      backgroundColor: colors.textPrimary,
      borderRadius: borderRadius.full,
      bottom: 1,
      height: 3,
      position: 'absolute',
      width: 3,
    },
    notificationDot: {
      backgroundColor: colors.primary,
      borderColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: 2,
      height: 9,
      position: 'absolute',
      right: 4,
      top: 4,
      width: 9,
    },
  });
}
