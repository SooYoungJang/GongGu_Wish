import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../../components/ui/SText';

import { borderRadius, spacing } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

type SubmitPromptProps = {
  onPressSubmit: () => void;
};

export function SubmitPrompt({ onPressSubmit }: SubmitPromptProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.submitPrompt}>
      <SText variant="cardTitle" style={s.submitPromptTitle}>놓치기 아까운 공구를 제보해 주세요</SText>
      <SText variant="cardSummary" style={s.submitPromptText}>승인된 제보만 캘린더와 알림에 표시돼요.</SText>
      <Pressable
        accessibilityLabel="공구 제보하기"
        accessibilityRole="button"
        onPress={onPressSubmit}
        style={s.submitPromptButton}
      >
        <SText variant="label" style={s.submitPromptButtonText}>공구 제보하기</SText>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    submitPrompt: { backgroundColor: colors.primaryBg, borderRadius: borderRadius['2xl'], marginBottom: spacing.xl, padding: spacing.lg },
    submitPromptTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: spacing.xs },
    submitPromptText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
    submitPromptButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    submitPromptButtonText: { color: colors.textInverse, fontSize: 14, fontWeight: '800' },
  });
}
