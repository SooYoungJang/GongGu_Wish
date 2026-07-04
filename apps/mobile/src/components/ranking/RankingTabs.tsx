import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import type { RankingTab } from '../../features/ranking/types';

export interface RankingTabsProps {
  value: RankingTab;
  rankingCount?: number;
  followingCount?: number;
  onChange: (next: RankingTab) => void;
}

const TABS: readonly { key: RankingTab; label: string; countKey: 'rankingCount' | 'followingCount' }[] = [
  { key: 'ranking', label: '랭킹', countKey: 'rankingCount' },
  { key: 'following', label: '팔로잉 셀러', countKey: 'followingCount' },
] as const;

export function RankingTabs({ value, rankingCount, followingCount, onChange }: RankingTabsProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const counts = { rankingCount, followingCount };

  return (
    <View style={s.container} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.key === value;
        const count = counts[tab.countKey];

        return (
          <Pressable
            key={tab.key}
            accessibilityLabel={`${tab.label} 탭`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={[s.tab, selected && s.selectedTab]}
          >
            <SText variant="label" style={[s.tabText, selected && s.selectedTabText]}>
              {tab.label}
              {typeof count === 'number' ? ` ${count}` : ''}
            </SText>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      flexDirection: 'row',
      padding: 4,
    },
    selectedTab: {
      backgroundColor: colors.surface,
    },
    selectedTabText: {
      color: colors.accent,
    },
    tab: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      flex: 1,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    tabText: {
      color: colors.muted,
      fontWeight: '900',
    },
  });
}
