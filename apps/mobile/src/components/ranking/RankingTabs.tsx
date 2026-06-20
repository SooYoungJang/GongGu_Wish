import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing } from '../../design/tokens';
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
  const counts = { rankingCount, followingCount };

  return (
    <View style={styles.container} accessibilityRole="tablist">
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
            style={[styles.tab, selected && styles.selectedTab]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {tab.label}
              {typeof count === 'number' ? ` ${count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedLabel: {
    color: colors.primary,
  },
  selectedTab: {
    backgroundColor: colors.surface,
  },
  tab: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
});
