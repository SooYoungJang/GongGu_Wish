import { StyleSheet, View } from 'react-native';

import { SText } from './ui/SText';
import { colors, spacing } from '../design/tokens';

export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <SText variant="label" style={styles.infoLabel}>{label}</SText>
      <SText variant="body" style={styles.infoValue}>{value}</SText>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    width: 80,
  },
  infoValue: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
