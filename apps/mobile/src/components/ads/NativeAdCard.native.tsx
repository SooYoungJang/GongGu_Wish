import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";

import { useAds } from "../../ads/AdsContext.native";
import {
  emitAdsDiagnostic,
  getAdsErrorCode,
  getAdsErrorReason,
  getAdsNativeErrorMetadata,
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

// Keep the app watchdog beyond the Android SDK's 60s HTTP timeout so the
// bridge can reject with the real Mobile Ads error code before we give up.
const NATIVE_AD_REQUEST_TIMEOUT_MS = 65_000;
const NATIVE_AD_MAX_ATTEMPTS = 3;
// The SDK's video HTML can round a few pixels beyond its registered MediaView.
const REEL_MEDIA_EDGE_INSET = 2;
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
  const windowDimensions = useWindowDimensions();
  const isReel = variant === "reel";
  const [loadedNativeAd, setLoadedNativeAd] = useState<LoadedNativeAd | null>(
    null,
  );
  const [requestUnavailable, setRequestUnavailable] = useState(false);
  const [reelLayout, setReelLayout] = useState<ReelLayout>({
    height: 0,
    width: 0,
  });
  const handleReelLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height <= 0 || width <= 0) return;
    setReelLayout((current) =>
      current.height === height && current.width === width
        ? current
        : { height, width },
    );
  }, []);
  const handleMediaLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      if (!loadedNativeAd || height <= 0 || width <= 0) return;
      emitAdsDiagnostic({
        event: "native_ad_media_layout",
        placement,
        variant,
        height,
        width,
        hasVideoContent:
          loadedNativeAd.nativeAd.mediaContent?.hasVideoContent ?? false,
      });
    },
    [loadedNativeAd, placement, variant],
  );

  useEffect(() => {
    setLoadedNativeAd(null);
    setRequestUnavailable(false);
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
    let requestAttempt = 0;
    let cancelRetryWait: (() => void) | undefined;
    onLoadStateChange?.("loading");

    void loadNativeAdWithRetry({
      load: async () => {
        const module = await getGoogleMobileAdsModule();
        if (!module) throw new Error("Google Mobile Ads module unavailable");
        requestAttempt += 1;
        emitAdsDiagnostic({
          event: "native_ad_request_started",
          placement,
          variant,
          attempt: requestAttempt,
          maxAttempts: NATIVE_AD_MAX_ATTEMPTS,
        });
        const nativeAd = await module.NativeAd.createForAdRequest(unitId, {
          adChoicesPlacement: module.NativeAdChoicesPlacement.TOP_RIGHT,
          startVideoMuted: true,
        });
        return { module, nativeAd };
      },
      maxAttempts: NATIVE_AD_MAX_ATTEMPTS,
      onLateSuccess: ({ nativeAd }) => nativeAd.destroy(),
      shouldRetry: () => active,
      timeoutMs: NATIVE_AD_REQUEST_TIMEOUT_MS,
      waitForRetry: (delayMs) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            cancelRetryWait = undefined;
            resolve();
          }, delayMs);
          cancelRetryWait = () => {
            clearTimeout(timer);
            resolve();
          };
        }),
      onAttemptFailure: ({
        attempt,
        error,
        maxAttempts,
        retryDelayMs,
        willRetry,
      }) => {
        if (!active) return;
        emitAdsDiagnostic(
          {
            event: willRetry ? "native_ad_retry" : "native_ad_failed",
            placement,
            variant,
            attempt,
            maxAttempts,
            errorCode: getAdsErrorCode(error),
            errorReason: getAdsErrorReason(error),
            ...getAdsNativeErrorMetadata(error),
            retryDelayMs,
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
        setRequestUnavailable(true);
        onLoadStateChange?.("unavailable");
      });

    return () => {
      active = false;
      cancelRetryWait?.();
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
    placement,
    unitId,
    variant,
  ]);

  if (!enabled || !isReady || !unitId || !visible) {
    return null;
  }

  if (!loadedNativeAd) {
    if (variant !== "row" || !loadEnabled || requestUnavailable) return null;
    // Virtualized feeds need a measurable row while the SDK request is pending.
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="광고를 불러오는 중"
        style={[styles.row, style]}
        testID={testID ? `${testID}-loading` : undefined}
      >
        <Text style={styles.loadingLabel}>광고를 불러오는 중</Text>
      </View>
    );
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
  // Register the MediaView with the first native ad render. Waiting for the
  // custom native container's onLayout can bind a video ad without its media.
  const reelFrameHeight = reelLayout.height || windowDimensions.height;
  const reelFrameWidth = reelLayout.width || windowDimensions.width;
  const resolvedReelBottomInset = isReel
    ? reelFrameHeight > 0
      ? Math.min(requestedReelBottomInset, reelFrameHeight - 1)
      : requestedReelBottomInset
    : 0;
  const reelMediaSize = isReel
    ? getContainedMediaSize(
        reelFrameWidth - REEL_MEDIA_EDGE_INSET * 2,
        reelFrameHeight - resolvedReelBottomInset - REEL_MEDIA_EDGE_INSET * 2,
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
            onLayout={handleMediaLayout}
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
