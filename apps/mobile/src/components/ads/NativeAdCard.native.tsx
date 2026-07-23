import { memo, useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";

import { useAds } from "../../ads/AdsContext.native";
import {
  getGoogleMobileAdsModule,
  type GoogleMobileAdsModule,
} from "../../ads/loadGoogleMobileAds";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { makeNativeAdStyles } from "./NativeAdCard.styles";
import type { NativeAdCardProps } from "./NativeAdCard.types";

export type {
  NativeAdCardProps,
  NativeAdLoadStatus,
} from "./NativeAdCard.types";

const LOAD_TIMEOUT_MS = 5_000;
type NativeAdInstance = Awaited<
  ReturnType<GoogleMobileAdsModule["NativeAd"]["createForAdRequest"]>
>;
type LoadedNativeAd = {
  module: GoogleMobileAdsModule;
  nativeAd: NativeAdInstance;
};

export const NativeAdCard = memo(function NativeAdCard({
  loadEnabled = true,
  onLoadStateChange,
  placement = "home",
  style,
  testID,
  variant = "card",
  visible = true,
}: NativeAdCardProps) {
  const { enabled, isReady, isSettled, nativeUnitIds } = useAds();
  const unitId = nativeUnitIds[placement];
  const theme = useCommerceTheme();
  const styles = useMemo(() => makeNativeAdStyles(theme), [theme]);
  const [loadedNativeAd, setLoadedNativeAd] = useState<LoadedNativeAd | null>(
    null,
  );

  useEffect(() => {
    setLoadedNativeAd(null);
    if (!loadEnabled) return;
    if (!enabled || !unitId || (isSettled && !isReady)) {
      onLoadStateChange?.("unavailable");
      return;
    }
    if (!isReady) {
      onLoadStateChange?.("loading");
      return;
    }

    let active = true;
    let timedOut = false;
    let loadedAd: NativeAdInstance | null = null;
    onLoadStateChange?.("loading");

    const timeout = setTimeout(() => {
      timedOut = true;
      setLoadedNativeAd(null);
      onLoadStateChange?.("unavailable");
    }, LOAD_TIMEOUT_MS);

    void getGoogleMobileAdsModule()
      .then(async (module) => {
        if (!module) return null;
        const nativeAd = await module.NativeAd.createForAdRequest(unitId, {
          adChoicesPlacement: module.NativeAdChoicesPlacement.TOP_RIGHT,
          aspectRatio:
            variant === "reel"
              ? module.NativeMediaAspectRatio.PORTRAIT
              : variant === "tile" || variant === "row"
                ? module.NativeMediaAspectRatio.SQUARE
                : module.NativeMediaAspectRatio.LANDSCAPE,
          startVideoMuted: true,
        });
        return { module, nativeAd };
      })
      .then((result) => {
        if (!result) {
          clearTimeout(timeout);
          if (active && !timedOut) onLoadStateChange?.("unavailable");
          return;
        }
        const { module, nativeAd } = result;
        if (!active || timedOut) {
          nativeAd.destroy();
          return;
        }
        clearTimeout(timeout);
        loadedAd = nativeAd;
        setLoadedNativeAd({ module, nativeAd });
        onLoadStateChange?.("loaded");
      })
      .catch(() => {
        if (!active || timedOut) return;
        clearTimeout(timeout);
        setLoadedNativeAd(null);
        onLoadStateChange?.("unavailable");
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      // NativeAd owns native media resources and must be explicitly released.
      // https://docs.page/invertase/react-native-google-mobile-ads/native-ads#destroying-ads
      loadedAd?.destroy();
    };
  }, [
    enabled,
    isReady,
    isSettled,
    loadEnabled,
    onLoadStateChange,
    unitId,
    variant,
  ]);

  if (!enabled || !isReady || !unitId || !loadedNativeAd || !visible) {
    return null;
  }

  const { module, nativeAd } = loadedNativeAd;
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } =
    module;
  const body = nativeAd.body?.trim();
  const callToAction = nativeAd.callToAction?.trim();
  const hasMedia = Boolean(nativeAd.mediaContent);
  const isReel = variant === "reel";
  const isRow = variant === "row";
  const isTile = variant === "tile";
  const isCompact = isRow || isTile;
  const containerStyle = isReel
    ? styles.reel
    : isRow
      ? styles.row
      : isTile
        ? styles.tile
        : styles.card;
  const mediaFrameStyle = isReel
    ? styles.reelMediaFrame
    : isRow
      ? styles.rowMediaFrame
      : isTile
        ? styles.tileMediaFrame
        : styles.cardMediaFrame;
  const mediaStyle = isReel
    ? styles.reelMedia
    : isCompact
      ? styles.compactMedia
      : styles.cardMedia;
  const contentStyle = isReel
    ? styles.reelContent
    : isRow
      ? styles.rowContent
      : isTile
        ? styles.tileContent
        : styles.cardContent;

  return (
    <NativeAdView
      accessibilityLabel={`광고, ${nativeAd.headline}`}
      nativeAd={nativeAd}
      style={[containerStyle, style]}
      testID={testID}
    >
      {isCompact && hasMedia ? (
        <View style={styles.compactMediaLabelRow}>
          <Text accessibilityLabel="광고" style={styles.adLabel}>
            광고
          </Text>
        </View>
      ) : !isCompact ? (
        <View style={isReel ? styles.reelLabelRow : styles.cardLabelRow}>
          <Text accessibilityLabel="광고" style={styles.adLabel}>
            광고
          </Text>
        </View>
      ) : null}

      {hasMedia ? (
        <View style={mediaFrameStyle}>
          <NativeMediaView resizeMode="contain" style={mediaStyle} />
        </View>
      ) : null}

      <View style={contentStyle}>
        {isCompact && !hasMedia ? (
          <View style={styles.compactLabelRow}>
            <Text accessibilityLabel="광고" style={styles.adLabel}>
              광고
            </Text>
          </View>
        ) : null}
        <View style={isCompact ? styles.compactTitleRow : styles.titleRow}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: nativeAd.icon.url }}
                style={isCompact ? styles.compactIcon : styles.icon}
              />
            </NativeAsset>
          ) : null}
          <View style={isCompact ? styles.compactTitleCopy : styles.titleCopy}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text
                numberOfLines={isCompact ? 2 : undefined}
                style={
                  isReel
                    ? styles.reelHeadline
                    : isCompact
                      ? styles.compactHeadline
                      : styles.cardHeadline
                }
              >
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text
                  numberOfLines={isCompact ? 1 : undefined}
                  style={
                    isReel
                      ? styles.reelBody
                      : isCompact
                        ? styles.compactBody
                        : styles.cardBody
                  }
                >
                  {body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>

        {nativeAd.advertiser || callToAction ? (
          <View style={isCompact ? styles.compactFooter : styles.footer}>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text
                  numberOfLines={1}
                  style={
                    isReel
                      ? styles.reelAdvertiser
                      : isCompact
                        ? styles.compactAdvertiser
                        : styles.cardAdvertiser
                  }
                >
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            ) : (
              <View />
            )}
            {callToAction ? (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <Text
                  accessibilityRole="button"
                  numberOfLines={1}
                  style={
                    isCompact ? styles.compactCallToAction : styles.callToAction
                  }
                >
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
