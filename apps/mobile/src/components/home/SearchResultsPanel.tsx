import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SText } from '../../components/ui/SText';

import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { Influencer } from '../../types';

type SearchResultsPanelProps = {
  results: Influencer[];
  onPressInfluencer: (influencer: Influencer) => void;
};

export function SearchResultsPanel({ results, onPressInfluencer }: SearchResultsPanelProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.searchPanel}>
      <SText variant="label" style={s.searchPanelTitle}>인플루언서</SText>
      {results.length > 0 ? (
        results.map((influencer) => (
          <Pressable
            key={influencer.id}
            accessibilityLabel={`${influencer.instagramUsername} 인플루언서 보기`}
            accessibilityRole="button"
            onPress={() => onPressInfluencer(influencer)}
            style={({ pressed }) => [s.searchResultRow, pressed && s.pressed]}
          >
            <View style={s.avatar}>
              <SText variant="caption" style={s.avatarText}>{(influencer.displayName ?? influencer.instagramUsername).slice(0, 1).toUpperCase()}</SText>
            </View>
            <View style={s.resultTextBlock}>
              <SText variant="label" style={s.searchResultName}>{influencer.displayName ?? influencer.instagramUsername}</SText>
              <SText variant="caption" style={s.searchResultMeta}>@{influencer.instagramUsername.replace(/^@/, '')}</SText>
            </View>
            <SText variant="body" style={s.chevron}>›</SText>
          </Pressable>
        ))
      ) : (
        <View style={s.emptySearchResult}>
          <SText variant="label" style={s.emptySearchTitle}>검색 결과가 없어요</SText>
          <SText variant="caption" style={s.emptySearchText}>인스타그램 username 또는 브랜드명을 다시 확인해 주세요.</SText>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    searchPanel: { marginBottom: spacing.lg, marginTop: spacing.lg },
    searchPanelTitle: { color: colors.text, fontSize: 20, fontWeight: '900', lineHeight: 27, marginBottom: 14 },
    searchResultRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 62,
      paddingVertical: spacing.sm,
    },
    pressed: { opacity: 0.64 },
    avatar: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      marginRight: spacing.md,
      width: 42,
    },
    avatarText: { color: colors.accent, fontSize: 15, fontWeight: '900', lineHeight: 19 },
    resultTextBlock: { flex: 1 },
    searchResultName: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
    searchResultMeta: { color: colors.weak, fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 2 },
    chevron: { color: colors.weak, fontSize: 24, lineHeight: 28 },
    emptySearchResult: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.lg,
      borderWidth: 1,
      marginBottom: spacing.sm,
      padding: spacing.lg,
    },
    emptySearchTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: spacing.xs },
    emptySearchText: { color: colors.weak, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  });
}
