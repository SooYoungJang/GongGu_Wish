# AC3: SText style prop override — Grep Evidence

## Command
```bash
grep -rn "style=" apps/mobile/src/components/*.tsx | grep -i stext
```

## Results (2026-06-23)

### AlertCard.tsx — 9 instances
```
AlertCard.tsx:23:  <SText variant="eyebrow" style={styles.brandBadgeEyebrow}>BRAND</SText>
AlertCard.tsx:24:  <SText variant="caption" style={styles.brandBadgeText} numberOfLines={2}>{brandLabel}</SText>
AlertCard.tsx:29:  <SText variant="eyebrow" style={styles.influencerName} numberOfLines={1}>@{influencerUsername}</SText>
AlertCard.tsx:31:  <SText variant="badge" style={styles.deadlineText}>{deadlineLabel}</SText>
AlertCard.tsx:35:  <SText variant="cardTitle" style={styles.productName} numberOfLines={1}>{item.productName}</SText>
AlertCard.tsx:38:  <SText variant="cardBrand" style={styles.discount} numberOfLines={1}>{discountLabel}</SText>
AlertCard.tsx:40:  <SText variant="badge" style={styles.confidenceText}>신뢰도 {confidencePercent}%</SText>
AlertCard.tsx:44:  <SText variant="caption" style={styles.timeText} numberOfLines={1}>시간 정보 · {deadlineLabel}</SText>
AlertCard.tsx:46:  {item.summary ? <SText variant="caption" style={styles.summary} numberOfLines={2}>{item.summary}</SText> : null}
```

### AppButton.tsx — 1 instance
```
AppButton.tsx:36:  <SText variant="button" style={[styles.text, variant === 'secondary' && styles.secondaryText]}>
```

### DealCard.tsx — 6 instances
```
DealCard.tsx:36:  <SText variant="cardTitle" style={[styles.imageText, { color: token.text }]}>
DealCard.tsx:38:  <SText variant="subtitle" numberOfLines={2} style={styles.title}>
DealCard.tsx:39:  <SText variant="caption" numberOfLines={1} style={styles.brand}>
DealCard.tsx:40:  <SText variant="cardBrand" style={styles.discount}>
DealCard.tsx:41:  <SText variant="caption" style={styles.deadline}>
```

### FormInput.tsx — 1 instance
```
FormInput.tsx:13:  <SText variant="label" style={styles.label}>{label}</SText>
```

### InfluencerCard.tsx — 3 instances
```
InfluencerCard.tsx:25:  <SText variant="cardBrand" style={{ color: colors.accent, fontWeight: '800' }}>
InfluencerCard.tsx:29:  <SText variant="subtitle" style={{ color: colors.textPrimary, fontWeight: '800', marginBottom: spacing.xxs }}>
InfluencerCard.tsx:38:  <SText variant="badge" style={{ fontSize: 11, fontWeight: '700' }}>
```

### InfoRow.tsx — 2 instances
```
InfoRow.tsx:10:  <SText variant="label" style={styles.infoLabel}>{label}</SText>
InfoRow.tsx:11:  <SText variant="body" style={styles.infoValue}>{value}</SText>
```

### ScreenHeader.tsx — 1 instance
```
ScreenHeader.tsx:25:  {subtitle ? <SText variant="subtitle" style={styles.subtitle}>{subtitle}</SText> : null}
```

### SearchBar.tsx — 2 instances
```
SearchBar.tsx:17:  <SText variant="body" style={styles.iconText}>⌕</SText>
SearchBar.tsx:37:  <SText variant="body" style={styles.clearText}>×</SText>
```

## Summary

| File | Style override count | Override type |
|------|---------------------|---------------|
| AlertCard.tsx | 9 | StyleSheet references |
| AppButton.tsx | 1 | Inline array + conditional |
| DealCard.tsx | 5 | StyleSheet + inline object |
| FormInput.tsx | 1 | StyleSheet reference |
| InfluencerCard.tsx | 3 | Full inline object |
| InfoRow.tsx | 2 | StyleSheet references |
| ScreenHeader.tsx | 1 | StyleSheet reference |
| SearchBar.tsx | 2 | StyleSheet references |
| **Total** | **24** | |

All 24 instances confirm that SText's `style` prop is actively used across 8 component files
to override or extend the base typography variant styles.

## Verification

The SText component implementation confirms the override mechanism:
```tsx
// SText.tsx:70-72
export function SText({ variant, style, ...rest }: STextProps) {
  return <Text style={[VARIANT_STYLES[variant], style]} {...rest} />;
}
```

Custom `style` is placed *after* the variant style in the array, so it correctly wins
over variant defaults (React Native style array semantics: later entries override earlier ones).
