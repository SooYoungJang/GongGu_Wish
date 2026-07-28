import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Image, Text, View, type LayoutChangeEvent } from "react-native";

import { useAds } from "../../ads/AdsContext.native";
import {
  emitAdsDiagnostic,
  getAdsErrorCode,
} from "../../ads/adsDiagnostics";
import { loadNativeAdWithRetry } from "../../ads/loadNativeAd";
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

const NATIVE_AD_REQUEST_TIMEOUT_MS = 15_000;
const NATIVE_AD_RETRY_DELAYS_MS = [750] as const;
type NativeAdInstance = Awaited<
  ReturnType<GoogleMobileAdsModule["NativeAd"]["createForAdRequest"]>
>;
type LoadedNativeAd = {
  module: GoogleMobileAdsModule;
  nativeAd: NativeAdInstance;
};
type ReelLayout = { height: number; width: number };

function getContainedMediaSize(
  frameWidth: number,
  frameHeight: number,
  aspectRatio: number | null | undefined,
): ReelLayout | null {
  if (frameWidth <= 0 || frameHeight <= 0) return null;

  const validAspectRatio =
    typeof aspectRatio === "number" &&
    Number.isFinite(aspectRatio) &&
    aspectRatio > 0
      ? aspectRatio
      : 9 / 16;
  const widthAtFullHeight = frameHeight * validAspectRatio;

  return widthAtFullHeight <= frameWidth
    ? { height: frameHeight, width: widthAtFullHeight }
    : { height: frameWidth / validAspectRatio, width: frameWidth };
}

export const NativeAdCard = memo(function NativeAdCard({
  loadEnabled = true,
  onLoadStateChange,
  placement = "home",
  reelBottomInset = 0,
  style,
  testID,
  variant = "card",
  visible = true,
}: NativeAdCardProps) {
  const { enabled, isReady, isSettled, nativeUnitIds } = useAds();
  const unitId = nativeUnitIds[placement];
  const theme = useCommerceTheme();
  const styles = useMemo(() => makeNativeAdStyles(theme), [theme]);
  const isReel = variant === "reel";
  const [loadedNativeAd, setLoadedNativeAd] = useState<LoadedNativeAd | null>(
    null,
  );
  const [reelLayout, setReelLayout] = useState<ReelLayout>({
    height: 0,
    width: 0,
  });
  const handleReelLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setReelLayout((current) =>
      current.height === height && current.width === width
        ? current
        : { height, width },
    );
  }, []);

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
    let loadedAd: NativeAdInstance | null = null;
    onLoadStateChange?.("loading");

    void loadNativeAdWithRetry({
      load: async () => {
        const module = await getGoogleMobileAdsModule();
        if (!module) throw new Error("Google Mobile Ads module unavailable");
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
      },
      maxAttempts: 2,
      onLateSuccess: ({ nativeAd }) => nativeAd.destroy(),
      shouldRetry: () => active,
      timeoutMs: NATIVE_AD_REQUEST_TIMEOUT_MS,
      waitForRetry: (attempt) =>
        new Promise((resolve) => {
          setTimeout(
            resolve,
            NATIVE_AD_RETRY_DELAYS_MS[
              Math.min(attempt - 1, NATIVE_AD_RETRY_DELAYS_MS.length - 1)
            ],
          );
        }),
      onAttemptFailure: ({ attempt, error, maxAttempts }) => {
        emitAdsDiagnostic(
          {
            event:
              attempt < maxAttempts ? "native_ad_retry" : "native_ad_failed",
            placement,
            variant,
            attempt,
            maxAttempts,
            errorCode: getAdsErrorCode(error),
          },
          (payload) => console.warn(payload),
        );
      },
    })
      .then((result) => {
        const { module, nativeAd } = result;
        if (!active) {
          nativeAd.destroy();
          return;
        }
        loadedAd = nativeAd;
        setLoadedNativeAd({ module, nativeAd });
        onLoadStateChange?.("loaded");
        emitAdsDiagnostic({
          event: "native_ad_loaded",
          placement,
          variant,
        });
      })
      .catch(() => {
        if (!active) return;
        setLoadedNativeAd(null);
        onLoadStateChange?.("unavailable");
      });

    return () => {
      active = false;
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
  const requestedReelBottomInset =
    Number.isFinite(reelBottomInset) && reelBottomInset > 0
      ? reelBottomInset
      : 0;
  const resolvedReelBottomInset = isReel
    ? reelLayout.height > 0
      ? Math.min(requestedReelBottomInset, reelLayout.height - 1)
      : requestedReelBottomInset
    : 0;
  const reelMediaSize = isReel
    ? getContainedMediaSize(
        reelLayout.width,
        reelLayout.height - resolvedReelBottomInset,
        nativeAd.mediaContent?.aspectRatio,
      )
    : null;
  const shouldRenderMedia = hasMedia && (!isReel || reelMediaSize !== null);

  return (
    <NativeAdView
      accessibilityLabel={`광고, ${nativeAd.headline}`}
      nativeAd={nativeAd}
      onLayout={isReel ? handleReelLayout : undefined}
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

      {shouldRenderMedia ? (
        <View
          style={
            isReel
              ? [mediaFrameStyle, { bottom: resolvedReelBottomInset }]
              : mediaFrameStyle
          }
        >
          <NativeMediaView
            resizeMode="contain"
            style={isReel ? [mediaStyle, reelMediaSize] : mediaStyle}
          />
        </View>
      ) : null}

      <View
        style={
          isReel
            ? [contentStyle, { bottom: resolvedReelBottomInset }]
            : contentStyle
        }
      >
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
