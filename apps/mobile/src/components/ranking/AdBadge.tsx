import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, rankingColors, spacing } from '../../design/tokens';

export function AdBadge() {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: rankingColors.ad.bg,
          borderColor: rankingColors.ad.border,
        },
      ]}
      accessibilityLabel="광고 셀러"
    >
      <Text style={[styles.text, { color: rankingColors.ad.text }]}>AD</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  text: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
