import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, colors, shadows, spacing, typography } from '../design/tokens';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
};

export function SearchBar({ value, onChangeText, placeholder = '@username으로 인플루언서 검색', onClear }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBubble}>
        <SText variant="body" style={styles.iconText}>⌕</SText>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        style={styles.input}
        testID="influencer-search-input"
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="검색어 지우기"
          hitSlop={8}
          onPress={onClear ?? (() => onChangeText(''))}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <SText variant="body" style={styles.clearText}>×</SText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.full,
    height: 32,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 32,
  },
  iconText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    minHeight: 40,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.full,
    height: 28,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 28,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});
