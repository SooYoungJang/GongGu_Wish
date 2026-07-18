import { memo, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdChoicesPlacement,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { useAds } from "../../ads/AdsContext.android";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import type { NativeAdCardProps } from "./NativeAdCard.types";

export type {
  NativeAdCardProps,
  NativeAdLoadStatus,
} from "./NativeAdCard.types";

const LOAD_TIMEOUT_MS = 5_000;

export const NativeAdCard = memo(function NativeAdCard({
  onLoadStateChange,
  testID,
}: NativeAdCardProps) {
  const { enabled, homeNativeUnitId, isReady, isSettled } = useAds();
  const theme = useCommerceTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    setNativeAd(null);
    if (!enabled || !homeNativeUnitId || (isSettled && !isReady)) {
      onLoadStateChange?.("unavailable");
      return;
    }
    if (!isReady) {
      onLoadStateChange?.("loading");
      return;
    }

    let active = true;
    let timedOut = false;
    let loadedAd: NativeAd | null = null;
    onLoadStateChange?.("loading");

    const timeout = setTimeout(() => {
      timedOut = true;
      setNativeAd(null);
      onLoadStateChange?.("unavailable");
    }, LOAD_TIMEOUT_MS);

    void NativeAd.createForAdRequest(homeNativeUnitId, {
      adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT,
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
      startVideoMuted: true,
    })
      .then((ad) => {
        if (!active || timedOut) {
          ad.destroy();
          return;
        }
        clearTimeout(timeout);
        loadedAd = ad;
        setNativeAd(ad);
        onLoadStateChange?.("loaded");
      })
      .catch(() => {
        if (!active || timedOut) return;
        clearTimeout(timeout);
        setNativeAd(null);
        onLoadStateChange?.("unavailable");
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      loadedAd?.destroy();
    };
  }, [enabled, homeNativeUnitId, isReady, isSettled, onLoadStateChange]);

  if (!enabled || !isReady || !homeNativeUnitId || !nativeAd) return null;

  const body = nativeAd.body?.trim();
  const callToAction = nativeAd.callToAction?.trim();

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.card} testID={testID}>
      <View style={styles.adLabelRow}>
        <Text accessible accessibilityLabel="광고" style={styles.adLabel}>
          광고
        </Text>
      </View>

      {nativeAd.mediaContent ? (
        <View style={styles.mediaFrame}>
          <NativeMediaView resizeMode="contain" style={styles.media} />
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: nativeAd.icon.url }}
                style={styles.icon}
              />
            </NativeAsset>
          ) : null}
          <View style={styles.titleCopy}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline}>{nativeAd.headline}</Text>
            </NativeAsset>
            {body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.body}>{body}</Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>

        {nativeAd.advertiser || callToAction ? (
          <View style={styles.footer}>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser}>{nativeAd.advertiser}</Text>
              </NativeAsset>
            ) : (
              <View />
            )}
            {callToAction ? (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <Text accessibilityRole="button" style={styles.callToAction}>
                  {callToAction}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        ) : null}
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
      width: "100%",
    },
    adLabelRow: {
      alignItems: "flex-start",
      backgroundColor: colors.cardBg,
      paddingHorizontal: spacing.md,
      paddingRight: 56,
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
    mediaFrame: {
      backgroundColor: colors.softBg,
      borderRadius: radius.md,
      marginHorizontal: spacing.md,
      overflow: "hidden",
    },
    media: {
      backgroundColor: colors.softBg,
      width: "100%",
    },
    content: {
      gap: spacing.md,
      padding: spacing.md,
    },
    titleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.md,
    },
    titleCopy: {
      flex: 1,
      gap: spacing.sm,
    },
    icon: {
      borderRadius: radius.sm,
      height: 48,
      width: 48,
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
