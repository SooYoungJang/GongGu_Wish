import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SText } from '../../components/ui/SText';
import { borderRadius, spacing } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
};

export function SearchBar({ value, onChangeText, onClear }: SearchBarProps) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <View style={s.searchBar}>
      <SText variant="body" style={s.searchIcon}>⌕</SText>
      <TextInput
        accessibilityLabel="공구 검색"
        placeholder="브랜드명, 제품명으로 검색해보세요"
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        style={s.searchInput}
        showSoftInputOnFocus={true}
      />
      {value ? (
        <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="button" onPress={onClear} style={s.clearButton}>
          <SText variant="body" style={s.clearButtonText}>×</SText>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    searchBar: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.full,
      borderWidth: 0,
      flexDirection: 'row',
      height: 54,
      marginBottom: spacing['2xl'],
      paddingHorizontal: spacing.lg,
      ...shadows.md,
    },
    searchIcon: { color: colors.textTertiary, fontSize: 22, marginRight: spacing.sm },
    searchInput: { color: colors.textPrimary, flex: 1, fontSize: 15, height: 54, padding: 0 },
    clearButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
    clearButtonText: { color: colors.textSecondary, fontSize: 22 },
  });
}
