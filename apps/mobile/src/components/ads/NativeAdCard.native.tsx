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
  const isReel = variant === "reel";

  return (
    <NativeAdView
      accessibilityLabel={`광고, ${nativeAd.headline}`}
      nativeAd={nativeAd}
      style={[isReel ? styles.reel : styles.card, style]}
      testID={testID}
    >
      <View style={isReel ? styles.reelLabelRow : styles.cardLabelRow}>
        <Text accessibilityLabel="광고" style={styles.adLabel}>
          광고
        </Text>
      </View>

      {nativeAd.mediaContent ? (
        <View
          style={isReel ? styles.reelMediaFrame : styles.cardMediaFrame}
        >
          <NativeMediaView
            resizeMode="contain"
            style={isReel ? styles.reelMedia : styles.cardMedia}
          />
        </View>
      ) : null}

      <View style={isReel ? styles.reelContent : styles.cardContent}>
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
              <Text
                style={isReel ? styles.reelHeadline : styles.cardHeadline}
              >
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={isReel ? styles.reelBody : styles.cardBody}>
                  {body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>

        {nativeAd.advertiser || callToAction ? (
          <View style={styles.footer}>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text
                  style={
                    isReel ? styles.reelAdvertiser : styles.cardAdvertiser
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
