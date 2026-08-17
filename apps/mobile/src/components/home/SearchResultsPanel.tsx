import { memo, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { InstagramIdentity } from '../../components/ui/InstagramIdentity';
import { InstagramProfileAvatar } from '../../components/ui/InstagramProfileAvatar';
import { SText } from '../../components/ui/SText';

import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { Influencer } from '../../types';

type SearchResultsPanelProps = {
  results: Influencer[];
  // eslint-disable-next-line no-unused-vars
  onPressInfluencer: (influencer: Influencer) => void;
};

type SearchResultRowProps = {
  chevronColor: string;
  influencer: Influencer;
  // eslint-disable-next-line no-unused-vars
  onPressInfluencer: (influencer: Influencer) => void;
  s: ReturnType<typeof makeStyles>;
};

const SearchResultRow = memo(function SearchResultRow({ chevronColor, influencer, onPressInfluencer, s }: SearchResultRowProps) {
  const handlePress = useCallback(() => {
    onPressInfluencer(influencer);
  }, [influencer, onPressInfluencer]);
  const displayName = influencer.displayName?.trim() || null;

  return (
    <Pressable
      accessibilityLabel={`${influencer.instagramUsername} 인플루언서 보기`}
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [s.searchResultRow, pressed && s.pressed]}
    >
      <InstagramProfileAvatar
        profileImageUrl={influencer.profileImageUrl}
        size={42}
        style={s.avatar}
        username={influencer.instagramUsername}
      />
      <View style={s.resultTextBlock}>
        {displayName ? (
          <SText variant="label" style={s.searchResultName}>{displayName}</SText>
        ) : null}
        <InstagramIdentity
          navigationEnabled={false}
          showAvatar={false}
          size={displayName ? "compact" : "body"}
          textStyle={displayName ? s.searchResultMeta : s.searchResultPrimary}
          username={influencer.instagramUsername}
        />
      </View>
      <Ionicons accessible={false} color={chevronColor} name="chevron-forward" size={20} />
    </Pressable>
  );
});

export const SearchResultsPanel = memo(function SearchResultsPanel({ results, onPressInfluencer }: SearchResultsPanelProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.searchPanel}>
      <SText variant="label" style={s.searchPanelTitle}>인플루언서</SText>
      {results.length > 0 ? (
        results.map((influencer) => (
          <SearchResultRow
            chevronColor={colors.weak}
            key={influencer.id}
            influencer={influencer}
            onPressInfluencer={onPressInfluencer}
            s={s}
          />
        ))
      ) : (
        <View style={s.emptySearchResult}>
          <SText variant="label" style={s.emptySearchTitle}>검색 결과가 없어요</SText>
          <SText variant="caption" style={s.emptySearchText}>인스타그램 username 또는 브랜드명을 다시 확인해 주세요.</SText>
        </View>
      )}
    </View>
  );
});

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
      marginRight: spacing.md,
    },
    resultTextBlock: { flex: 1, minWidth: 0 },
    searchResultName: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
    searchResultMeta: { fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 2 },
    searchResultPrimary: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
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
