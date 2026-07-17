import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { useAds } from "../../ads/AdsContext";
import { useCommerceTheme } from "../../design/useCommerceTheme";

type NativeAdCardProps = {
  testID?: string;
};

export const NativeAdCard = memo(function NativeAdCard({
  testID,
}: NativeAdCardProps) {
  const { enabled, homeNativeUnitId, isReady } = useAds();
  const theme = useCommerceTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    setNativeAd(null);
    if (!enabled || !isReady || !homeNativeUnitId) return;

    let active = true;
    let loadedAd: NativeAd | null = null;

    void NativeAd.createForAdRequest(homeNativeUnitId)
      .then((ad) => {
        if (!active) {
          ad.destroy();
          return;
        }
        loadedAd = ad;
        setNativeAd(ad);
      })
      .catch(() => {
        if (active) setNativeAd(null);
      });

    return () => {
      active = false;
      loadedAd?.destroy();
    };
  }, [enabled, homeNativeUnitId, isReady]);

  if (!enabled || !isReady || !homeNativeUnitId || !nativeAd) return null;

  return (
    <NativeAdView
      accessible
      accessibilityLabel={`광고, ${nativeAd.headline}`}
      nativeAd={nativeAd}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.adLabelRow}>
        <Text style={styles.adLabel}>광고</Text>
      </View>

      <NativeMediaView resizeMode="cover" style={styles.media} />

      <View style={styles.content}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text numberOfLines={2} style={styles.headline}>
            {nativeAd.headline}
          </Text>
        </NativeAsset>

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text numberOfLines={2} style={styles.body}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        <View style={styles.footer}>
          {nativeAd.advertiser ? (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text numberOfLines={1} style={styles.advertiser}>
                {nativeAd.advertiser}
              </Text>
            </NativeAsset>
          ) : (
            <View />
          )}
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.callToAction}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        </View>
      </View>
    </NativeAdView>
  );
});

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;

  return StyleSheet.create({
    card: {
      backgroundColor: colors.cardBg,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexBasis: "100%",
      marginBottom: spacing.cardGap,
      overflow: "hidden",
      width: "100%",
    },
    adLabelRow: {
      alignItems: "flex-start",
      backgroundColor: colors.cardBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    adLabel: {
      ...typography.badge,
      backgroundColor: colors.softBg,
      borderRadius: radius.xs,
      color: colors.muted,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    media: {
      backgroundColor: colors.softBg,
      height: 168,
      width: "100%",
    },
    content: {
      gap: spacing.sm,
      padding: spacing.md,
    },
    headline: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    body: {
      ...typography.meta,
      color: colors.muted,
    },
    footer: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    advertiser: {
      ...typography.meta,
      color: colors.weak,
      flexShrink: 1,
    },
    callToAction: {
      ...typography.badge,
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      color: colors.inverse,
      minHeight: 44,
      overflow: "hidden",
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      textAlign: "center",
    },
  });
}
