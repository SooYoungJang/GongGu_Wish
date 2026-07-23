import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { getGroupBuyCategoryLabel } from "@gonggu/shared/utils/groupBuyCategory";
import { normalizeOptionalInstagramUsername } from "@gonggu/shared/utils/instagram";
import { VideoView, useVideoPlayer, type VideoPlayerStatus } from "expo-video";
import PagerView from "react-native-pager-view";
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { fetchGroupBuyById, fetchGroupBuys, logDeepView } from "../api";
import { Ionicons } from "@expo/vector-icons";
import { BackButton } from "../components/BackButton";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { NativeAdCard } from "../components/ads/NativeAdCard";
import type { NativeAdLoadStatus } from "../components/ads/NativeAdCard.types";
import { useAds } from "../ads/AdsContext";
import {
  insertReelsAdSlots,
  isReelsContentItem,
  seedAdRandomFromIds,
  type ReelsFeedItem,
} from "./reelsAdPlacement";
import { PriceText } from "../components/ui/PriceText";
import {
  useBookmarks,
  useNotifications,
  useRecentViews,
} from "../hooks/useLocalDeals";
import { SText } from "../components/ui/SText";
import { borderRadius, spacing } from "../design/tokens";
import {
  BOTTOM_SHEET_ANIMATION_MS,
  REELS_SUMMARY_SHEET_ANIMATION_MS,
} from "../design/bottomSheetMotion";
import { useTheme } from "../context/ThemeContext";
import { useNotificationPreferences } from "../context/NotificationPreferencesContext";
import type { ColorPalette } from "../context/ThemeContext";
import type { DetailScreenProps, GroupBuy } from "../types";
import { formatEndDate, getDaysRemaining } from "../utils";
import { normalizeForSearch } from "../utils/search";
import { usePlaybackLifecycle } from "../hooks/usePlaybackLifecycle";
import { useAuthGate } from "../hooks/useAuthGate";
import { useFocusedAndroidBackHandler } from "../navigation/androidBack";
import {
  DEEP_VIEW_THRESHOLD_MS,
  isPlaybackEligible,
} from "./playbackEligibility";

const MAX_VISIBLE_DOTS = 5;
const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".m3u8",
  ".mkv",
  ".avi",
  ".ts",
];
const SUMMARY_EDGE_DISMISS_DISTANCE = 56;
const SUMMARY_SCROLL_TOP_EPSILON = 2;
const DETAIL_SEARCH_CHROME_OFFSET = 72;
const SUMMARY_SHEET_MAX_HEIGHT_RATIO = 0.58;
const SEARCH_SHEET_MAX_HEIGHT_RATIO = 0.7;
// When the summary sheet is open the media stage shrinks to a centered card
// with this much inset on each side.
const MEDIA_STAGE_SIDE_INSET = 48;
const MEDIA_STAGE_MIN_HEIGHT = 300;
const MEDIA_STAGE_MIN_HEIGHT_RATIO = 0.38;
const MEDIA_STAGE_MIN_SHEET_SPACE = 168;
type MediaItem = {
  url: string;
  isVideo: boolean;
  thumbnailUrl?: string | null;
};

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    return VIDEO_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));
  }
}

function getDisplayMedia(groupBuy: GroupBuy): MediaItem[] {
  const typedMediaItems =
    groupBuy.mediaItems
      ?.filter((item) => item?.url)
      .map((item) => ({
        url: item.url,
        isVideo: item.mediaType === "VIDEO" || isVideoUrl(item.url),
        thumbnailUrl: item.thumbnailUrl ?? null,
      })) ?? [];

  if (typedMediaItems.length > 0) {
    return typedMediaItems;
  }

  const rawUrls = groupBuy.mediaUrls?.length
    ? groupBuy.mediaUrls
    : groupBuy.thumbnailUrl
      ? [groupBuy.thumbnailUrl]
      : [];
  const urls =
    groupBuy.videoUrl && !rawUrls.includes(groupBuy.videoUrl)
      ? [groupBuy.videoUrl, ...rawUrls]
      : rawUrls;

  return urls.map((url) => ({
    url,
    isVideo: url === groupBuy.videoUrl || isVideoUrl(url),
    thumbnailUrl: url === groupBuy.videoUrl ? groupBuy.thumbnailUrl : null,
  }));
}

export function hasPlayableVideoMedia(groupBuy?: GroupBuy): boolean {
  return Boolean(
    groupBuy && getDisplayMedia(groupBuy).some((item) => item.isVideo),
  );
}

const REEL_VIDEO_PRELOAD_DISTANCE = 2;

function createVideoSource(url: string) {
  return {
    uri: url,
    contentType: "auto" as const,
    useCaching: true,
  };
}

function safelyCallVideoPlayer(action: () => unknown) {
  try {
    const result = action();
    if (result && typeof (result as { then?: unknown }).then === "function") {
      void Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    // A native player can be released between a React effect and its command.
    // Playback is best-effort, so a stale command must not surface globally.
  }
}

function getFirstVideoUrl(groupBuy?: GroupBuy): string | null {
  if (!groupBuy) return null;
  return getDisplayMedia(groupBuy).find((item) => item.isVideo)?.url ?? null;
}

export function ReelVideoPreloader({
  items,
  activeIndex,
  direction = 1,
  enabled = true,
}: {
  items: GroupBuy[];
  activeIndex: number;
  direction?: -1 | 1;
  enabled?: boolean;
}) {
  const targetIndex = enabled
    ? activeIndex + direction * REEL_VIDEO_PRELOAD_DISTANCE
    : -1;
  const preloadUrl = getFirstVideoUrl(items[targetIndex]);
  const preloadSource = useMemo(
    () => (preloadUrl ? createVideoSource(preloadUrl) : null),
    [preloadUrl],
  );

  // Give the source to useVideoPlayer at construction time. Replacing the
  // source of a player that is not attached to a VideoView can race native
  // release on Android and surface an unhandled `reload` rejection. The hook
  // owns the player replacement/disposal lifecycle, while the player remains
  // paused so this still warms the distant source without changing quality.
  useVideoPlayer(preloadSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
  });

  return null;
}

function getReelItems(current: GroupBuy, fetched?: GroupBuy[]) {
  if (!fetched?.length) return [current];

  const seen = new Set<string>();
  let includedCurrent = false;
  const ordered = fetched.reduce<GroupBuy[]>((items, item) => {
    if (seen.has(item.id)) return items;

    seen.add(item.id);
    if (item.id === current.id) {
      includedCurrent = true;
      items.push(item);
    } else {
      items.push(item);
    }
    return items;
  }, []);

  return includedCurrent ? ordered : [current, ...ordered];
}

function getInitialReelIndex(current: GroupBuy, reelItems: GroupBuy[]) {
  const index = reelItems.findIndex((item) => item.id === current.id);
  return index >= 0 ? index : 0;
}

function getGroupBuyThumb(item: GroupBuy) {
  return (
    item.thumbnailUrl ??
    item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ??
    item.mediaItems?.find(
      (media) => !media.mediaType || media.mediaType === "IMAGE",
    )?.url ??
    item.mediaUrls?.[0] ??
    null
  );
}

function getSearchText(item: GroupBuy) {
  return [
    item.productName,
    item.brandName,
    item.category,
    item.discountInfo,
    item.summary,
    item.rawPost.influencer.instagramUsername,
  ]
    .filter(Boolean)
    .map((part) => normalizeForSearch(part))
    .join(" ");
}

function getVisibleDotIndexes(total: number, activeIndex: number) {
  const visibleCount = Math.min(total, MAX_VISIBLE_DOTS);
  let startIndex = 0;

  if (total > MAX_VISIBLE_DOTS) {
    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    if (activeIndex <= half) {
      startIndex = 0;
    } else if (activeIndex >= total - half - 1) {
      startIndex = total - MAX_VISIBLE_DOTS;
    } else {
      startIndex = activeIndex - half;
    }
  }

  return Array.from({ length: visibleCount }, (_, i) => startIndex + i);
}

type VideoSlideProps = {
  url: string;
  isActive: boolean;
  thumbnailUrl?: string | null;
  replayKey?: number;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  s: ReturnType<typeof makeStyles>;
};

const VideoSlide = memo(function VideoSlide({
  url,
  isActive,
  replayKey,
  thumbnailUrl,
  muted,
  onMutedChange,
  onPlaybackStateChange,
  s,
}: VideoSlideProps) {
  const [shouldPlay, setShouldPlay] = useState(true);
  const [localMuted, setLocalMuted] = useState(muted ?? false);
  const isMuted = muted ?? localMuted;
  const [areControlsVisible, setControlsVisible] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRequestIdRef = useRef(0);
  const retryIsActiveRef = useRef(isActive);
  const retryShouldPlayRef = useRef(shouldPlay);
  retryIsActiveRef.current = isActive;
  retryShouldPlayRef.current = shouldPlay;
  const source = useMemo(() => createVideoSource(url), [url]);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 1;
    p.audioMixingMode = "doNotMix";
    p.allowsExternalPlayback = false;
  });
  const [playerStatus, setPlayerStatus] = useState<VideoPlayerStatus>(
    player.status,
  );
  const [playerError, setPlayerError] = useState<unknown>(null);

  useEffect(() => {
    const updatePlaybackState = (isPlaying: boolean) => {
      onPlaybackStateChange?.(isActive && isPlaying);
    };

    updatePlaybackState(Boolean(player.playing));
    const subscription = player.addListener?.(
      "playingChange",
      ({ isPlaying }: { isPlaying: boolean }) => updatePlaybackState(isPlaying),
    );

    return () => {
      subscription?.remove();
      onPlaybackStateChange?.(false);
    };
  }, [isActive, onPlaybackStateChange, player]);

  useEffect(() => {
    const subscription = player.addListener?.(
      "statusChange",
      ({ status, error }: { status: VideoPlayerStatus; error?: unknown }) => {
        setPlayerStatus(status);
        setPlayerError(error ?? null);
      },
    );

    return () => subscription?.remove();
  }, [player]);

  useEffect(() => {
    safelyCallVideoPlayer(() => {
      player.muted = isMuted;
      player.volume = 1;
      player.audioMixingMode = "doNotMix";
    });
  }, [isMuted, player]);

  useEffect(() => {
    return () => {
      retryRequestIdRef.current += 1;
    };
  }, [player, source]);

  const retryPlayback = useCallback(() => {
    const requestId = retryRequestIdRef.current + 1;
    retryRequestIdRef.current = requestId;
    setPlayerStatus("loading");
    setPlayerError(null);
    try {
      const result = player.replaceAsync?.(source);
      if (result && typeof (result as { then?: unknown }).then === "function") {
        void Promise.resolve(result)
          .then(() => {
            if (retryRequestIdRef.current !== requestId) return;
            if (retryIsActiveRef.current && retryShouldPlayRef.current) {
              safelyCallVideoPlayer(() => player.play());
            }
          })
          .catch((error: unknown) => {
            if (retryRequestIdRef.current !== requestId) return;
            setPlayerStatus("error");
            setPlayerError(error);
          });
        return;
      }
      if (retryIsActiveRef.current && retryShouldPlayRef.current) player.play();
    } catch (error: unknown) {
      if (retryRequestIdRef.current !== requestId) return;
      setPlayerStatus("error");
      setPlayerError(error);
    }
  }, [isActive, player, shouldPlay, source]);

  const isPlayerLoading = playerStatus === "loading";
  const isPlayerError = playerStatus === "error" || Boolean(playerError);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    safelyCallVideoPlayer(() => {
      player.muted = isMuted;
      player.volume = 1;
      player.audioMixingMode = "doNotMix";

      if (isActive && shouldPlay) {
        player.play();
      } else {
        player.pause();
        if (!isActive) player.currentTime = 0;
      }
    });
  }, [isActive, isMuted, player, shouldPlay]);

  const replayKeyRef = useRef(replayKey);
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    const wasActive = isActiveRef.current;
    isActiveRef.current = isActive;
    if (replayKeyRef.current === replayKey) return;
    replayKeyRef.current = replayKey;
    if (!isActive || !wasActive) return;

    setShouldPlay(true);
    safelyCallVideoPlayer(() => {
      player.currentTime = 0;
      player.play();
    });
  }, [isActive, player, replayKey]);

  useEffect(() => {
    setHasFirstFrame(false);
  }, [url]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  const togglePlayback = useCallback(() => {
    showControlsTemporarily();
    setShouldPlay((current) => {
      const next = !current;
      safelyCallVideoPlayer(() => {
        player.muted = isMuted;
        player.volume = 1;
        player.audioMixingMode = "doNotMix";

        if (next && isActive) {
          player.play();
        } else {
          player.pause();
        }
      });
      return next;
    });
  }, [isActive, isMuted, player, showControlsTemporarily]);

  const toggleMuted = useCallback(() => {
    showControlsTemporarily();
    const next = !isMuted;
    setLocalMuted(next);
    onMutedChange?.(next);
  }, [isMuted, onMutedChange, showControlsTemporarily]);

  return (
    <View style={s.videoSlide}>
      <VideoView
        player={player}
        style={s.mediaFill}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
        surfaceType={Platform.OS === "android" ? "textureView" : undefined}
        onFirstFrameRender={() => {
          setHasFirstFrame(true);
          setPlayerStatus("readyToPlay");
          setPlayerError(null);
          safelyCallVideoPlayer(() => {
            player.muted = isMuted;
            player.volume = 1;
            player.audioMixingMode = "doNotMix";
            if (isActive && shouldPlay) player.play();
          });
        }}
      />
      {thumbnailUrl && !hasFirstFrame ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={s.videoPoster}
          resizeMode="contain"
        />
      ) : null}
      {isPlayerLoading ? (
        <View pointerEvents="none" style={s.videoStatusOverlay}>
          <ActivityIndicator color="#FFFFFF" />
          <SText style={s.videoStatusText} variant="caption">
            동영상 불러오는 중
          </SText>
        </View>
      ) : null}
      {isPlayerError ? (
        <View style={s.videoErrorOverlay}>
          <SText style={s.videoStatusText} variant="caption">
            동영상을 불러오지 못했어요
          </SText>
          <Pressable
            accessibilityLabel="동영상 다시 시도"
            accessibilityRole="button"
            onPress={retryPlayback}
            style={({ pressed }) => [s.videoRetryButton, pressed && s.pressed]}
          >
            <SText style={s.videoRetryLabel} variant="caption">
              다시 시도
            </SText>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        accessibilityLabel="동영상 컨트롤 표시"
        accessibilityRole="button"
        onPress={showControlsTemporarily}
        pressRetentionOffset={24}
        style={s.videoTapLayer}
      />
      {areControlsVisible || !shouldPlay ? (
        <View style={s.videoControlsOverlay} pointerEvents="box-none">
          <Pressable
            accessibilityLabel={isMuted ? "음소거 해제" : "음소거"}
            accessibilityRole="button"
            onPress={toggleMuted}
            style={({ pressed }) => [s.muteOverlayButton, pressed && s.pressed]}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable
            accessibilityLabel={shouldPlay ? "동영상 일시정지" : "동영상 재생"}
            accessibilityRole="button"
            onPress={togglePlayback}
            style={({ pressed }) => [s.playOverlayButton, pressed && s.pressed]}
          >
            <Ionicons
              name={shouldPlay ? "pause" : "play"}
              size={28}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

type ReelActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  testID?: string;
};

function ReelAction({ icon, label, onPress, s, testID }: ReelActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.railButton, pressed && s.pressed]}
      testID={testID}
    >
      <View style={s.railIconBox}>{icon}</View>
      <SText variant="caption" style={s.railLabel}>
        {label}
      </SText>
    </Pressable>
  );
}

function PurchaseGlyph({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.purchaseGlyph}>
      <View style={s.purchaseLinkRingA} />
      <View style={s.purchaseLinkRingB} />
      <View style={s.purchaseLinkBridge} />
    </View>
  );
}

function ReelPurchaseAction({
  onPress,
  s,
}: Pick<ReelActionProps, "onPress" | "s">) {
  return (
    <Pressable
      accessibilityLabel="구매 링크"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.purchaseRailButton, pressed && s.pressed]}
    >
      <PurchaseGlyph s={s} />
      <SText variant="caption" style={s.purchaseRailLabel}>
        구매 링크
      </SText>
    </Pressable>
  );
}

type DetailSearchDockProps = {
  bottomInset: number;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
};

function DetailSearchDock({ bottomInset, onPress, s }: DetailSearchDockProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[s.detailSearchDock, { paddingBottom: bottomInset + spacing.sm }]}
    >
      <Pressable
        accessibilityLabel="상품 검색"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [s.detailSearchButton, pressed && s.pressed]}
      >
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.82)" />
        <SText variant="body" style={s.detailSearchButtonText}>
          상품을 검색해보세요
        </SText>
      </Pressable>
    </View>
  );
}

type DetailSearchSheetProps = {
  bottomInset: number;
  data: GroupBuy[];
  maxHeight: number;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars
  onSheetLayout: (event: LayoutChangeEvent) => void;
  // eslint-disable-next-line no-unused-vars
  onSelect(item: GroupBuy): void;
  keyboardHeight: SharedValue<number>;
  query: string;
  sheetTranslate: SharedValue<number>;
  // eslint-disable-next-line no-unused-vars
  setQuery(query: string): void;
  s: ReturnType<typeof makeStyles>;
};

function DetailSearchSheet({
  bottomInset,
  data,
  maxHeight,
  onClose,
  onSelect,
  onSheetLayout,
  keyboardHeight,
  query,
  sheetTranslate,
  setQuery,
  s,
}: DetailSearchSheetProps) {
  const inputRef = useRef<TextInput>(null);
  const sheetDragStartY = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const searchSheetStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: sheetTranslate.value + keyboardHeight.value }],
    }),
    [keyboardHeight, sheetTranslate],
  );

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(6)
        .failOffsetX([-24, 24])
        .onBegin(() => {
          sheetDragStartY.value = sheetTranslate.value;
        })
        .onUpdate((event) => {
          const next = sheetDragStartY.value + event.translationY;
          sheetTranslate.value = Math.min(Math.max(next, 0), maxHeight);
        })
        .onEnd((event) => {
          const draggedDown = event.translationY > 12;
          const pastThreshold =
            event.translationY > Math.max(72, maxHeight * 0.28);
          const flickedDown = event.velocityY > 650;
          if (draggedDown && (pastThreshold || flickedDown)) {
            runOnJS(onClose)();
            return;
          }
          sheetTranslate.value = withTiming(0, {
            duration: BOTTOM_SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [maxHeight, onClose, sheetDragStartY, sheetTranslate],
  );

  return (
    <View style={s.detailSearchOverlay} pointerEvents="box-none">
      <Pressable
        accessibilityLabel="상품 검색 닫기"
        accessibilityRole="button"
        onPress={onClose}
        style={s.detailSearchBackdrop}
      />
      <View pointerEvents="box-none" style={s.detailSearchKeyboard}>
        <GestureDetector gesture={dismissGesture}>
          <Reanimated.View
            onLayout={onSheetLayout}
            style={[
              s.detailSearchSheet,
              {
                maxHeight,
                paddingBottom: bottomInset + spacing.md,
              },
              searchSheetStyle,
            ]}
          >
            <View style={s.detailSearchHandle} />
            <View style={s.detailSearchHeader}>
              <SText variant="cardTitle" style={s.detailSearchTitle}>
                상품 검색
              </SText>
            </View>
            <View style={s.detailSearchInputWrap}>
              <Ionicons
                name="search"
                size={18}
                color="rgba(255,255,255,0.58)"
              />
              <TextInput
                ref={inputRef}
                autoCorrect={false}
                autoFocus
                onChangeText={setQuery}
                placeholder="상품명, 브랜드, 인플루언서 검색"
                placeholderTextColor="rgba(255,255,255,0.46)"
                returnKeyType="search"
                style={s.detailSearchInput}
                value={query}
              />
            </View>
            <FlatList
              data={data}
              initialNumToRender={8}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={s.detailSearchEmpty}>
                  <SText variant="body" style={s.detailSearchEmptyText}>
                    검색 결과가 없어요
                  </SText>
                </View>
              }
              renderItem={({ item }) => {
                const thumb = getGroupBuyThumb(item);
                const sellerName = normalizeOptionalInstagramUsername(
                  item.rawPost.influencer.instagramUsername,
                );
                const sellerLabel =
                  [item.brandName?.trim(), sellerName ? `@${sellerName}` : null]
                    .filter((label): label is string => Boolean(label))
                    .join(" · ") || "판매자 정보 미정";
                return (
                  <Pressable
                    accessibilityLabel={`${item.productName ?? "상품"} 보기`}
                    accessibilityRole="button"
                    onPress={() => onSelect(item)}
                    style={({ pressed }) => [
                      s.detailSearchResult,
                      pressed && s.pressed,
                    ]}
                  >
                    {thumb ? (
                      <Image
                        source={{ uri: thumb }}
                        style={s.detailSearchThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={s.detailSearchThumbFallback}>
                        <Ionicons
                          name="cube-outline"
                          size={20}
                          color="rgba(255,255,255,0.7)"
                        />
                      </View>
                    )}
                    <View style={s.detailSearchResultBody}>
                      <SText
                        variant="cardTitle"
                        style={s.detailSearchResultTitle}
                        numberOfLines={1}
                      >
                        {item.productName ?? "제품명 미확인"}
                      </SText>
                      <SText
                        variant="caption"
                        style={s.detailSearchResultMeta}
                        numberOfLines={1}
                      >
                        {sellerLabel} · {formatEndDate(item.endDate)}
                      </SText>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="rgba(255,255,255,0.42)"
                    />
                  </Pressable>
                );
              }}
              maxToRenderPerBatch={8}
              removeClippedSubviews={Platform.OS === "android"}
              style={s.detailSearchList}
              windowSize={5}
            />
          </Reanimated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

export type ProductReelPageProps = {
  groupBuy: GroupBuy;
  isActive: boolean;
  playbackAllowed?: boolean;
  replayKey?: number;
  isSearchSheetVisible?: boolean;
  searchSheetMetrics?: {
    height: number;
    keyboardHeight: SharedValue<number>;
    translateY: SharedValue<number>;
  } | null;
  shouldPreloadVideo?: boolean;
  bottomChromeOffset?: number;
  pageHeight: number;
  mediaWidth: number;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  showBackButton?: boolean;
  showDetailAd?: boolean;
  onCloseSearchSheet?: () => void;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onPlaybackStateChange?: (itemId: string, isPlaying: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  onSummarySheetStateChange(isOpen: boolean, canSwipeReel: boolean): void;
  s: ReturnType<typeof makeStyles>;
};

function ProductReelPageComponent({
  groupBuy,
  isActive,
  playbackAllowed = isActive,
  replayKey,
  isSearchSheetVisible = false,
  searchSheetMetrics = null,
  shouldPreloadVideo = false,
  bottomChromeOffset = 0,
  pageHeight,
  mediaWidth,
  topInset,
  bottomInset,
  onBack,
  showBackButton = true,
  showDetailAd = false,
  onCloseSearchSheet,
  muted,
  onMutedChange,
  onPlaybackStateChange,
  onSummarySheetStateChange,
  s,
}: ProductReelPageProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isSummaryExpanded, setSummaryExpanded] = useState(false);
  const { colors } = useTheme();
  const { isAuthenticated, requireAuth } = useAuthGate();
  const {
    preferences,
    ready: notificationPreferencesReady,
    saving: notificationPreferencesSaving,
    toggleBrand,
    toggleInfluencer,
  } = useNotificationPreferences();
  const [summaryScrollContentHeight, setSummaryScrollContentHeight] =
    useState(0);
  const [summaryScrollViewportHeight, setSummaryScrollViewportHeight] =
    useState(0);
  const [isSummaryScrollAtTop, setSummaryScrollAtTop] = useState(true);
  const [isSummaryScrollAtBottom, setSummaryScrollAtBottom] = useState(false);
  const summaryScrollOffsetRef = useRef(0);
  const summaryScrollContentHeightRef = useRef(0);
  const summaryScrollViewportHeightRef = useRef(0);
  const summaryScrollAtTopRef = useRef(true);
  const summaryScrollAtBottomRef = useRef(false);
  const summaryScrollGestureStartedAtTopRef = useRef(true);
  const [isSummaryVisible, setSummaryVisible] = useState(false);
  const [summarySheetMeasuredHeight, setSummarySheetMeasuredHeight] =
    useState(0);
  const mediaItems = useMemo(() => getDisplayMedia(groupBuy), [groupBuy]);

  useEffect(() => {
    if (isActive && !mediaItems[activeMediaIndex]?.isVideo) {
      onPlaybackStateChange?.(groupBuy.id, false);
    }
  }, [
    activeMediaIndex,
    groupBuy.id,
    isActive,
    mediaItems,
    onPlaybackStateChange,
  ]);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const {
    getNotificationState,
    isNotifying,
    retryNotification,
    toggleNotification,
  } = useNotifications();
  const notificationState = getNotificationState(groupBuy.id);
  const notificationEnabled =
    isAuthenticated && isNotifying(groupBuy.id);
  const notificationLabel =
    notificationState.status === "pending"
      ? "알림 처리 중"
      : notificationState.status === "failed"
        ? "알림 재시도"
        : notificationState.status === "unsupported" ||
            notificationState.status === "unavailable"
          ? "알림 설정 불가"
          : notificationEnabled
            ? "알림설정됨"
            : "알림";
  const handleNotificationPress = useCallback(() => {
    if (!requireAuth()) return;
    if (
      notificationState.status === "failed" ||
      notificationState.status === "unsupported" ||
      notificationState.status === "unavailable"
    ) {
      void retryNotification(groupBuy);
      return;
    }
    void toggleNotification(groupBuy);
  }, [
    groupBuy,
    notificationState.status,
    requireAuth,
    retryNotification,
    toggleNotification,
  ]);
  const deadlineLabel = formatEndDate(groupBuy.endDate);
  const daysRemaining = getDaysRemaining(groupBuy.endDate);
  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;
  const sellerName =
    normalizeOptionalInstagramUsername(
      groupBuy.rawPost.influencer.instagramUsername,
    ) ?? "";
  const sellerHandle = sellerName ? `@${sellerName}` : null;
  const categoryLabel = getGroupBuyCategoryLabel(groupBuy.category);
  const isInfluencerFollowed = isAuthenticated && preferences.followedInfluencers.some(
    (target) =>
      target.toLocaleLowerCase("en-US") ===
      sellerName.toLocaleLowerCase("en-US"),
  );
  const brandName = groupBuy.brandName?.trim() ?? "";
  const isBrandFollowed = isAuthenticated && preferences.followedBrands.some(
    (target) =>
      target.toLocaleLowerCase("en-US") ===
      brandName.toLocaleLowerCase("en-US"),
  );
  const followControlsDisabled =
    !notificationPreferencesReady || notificationPreferencesSaving;
  const handleBookmarkPress = useCallback(() => {
    if (!requireAuth()) return;
    toggleBookmark(groupBuy);
  }, [groupBuy, requireAuth, toggleBookmark]);
  const handleInfluencerFollowPress = useCallback(() => {
    if (!requireAuth()) return;
    void toggleInfluencer(sellerName);
  }, [requireAuth, sellerName, toggleInfluencer]);
  const handleBrandFollowPress = useCallback(() => {
    if (!requireAuth()) return;
    void toggleBrand(brandName);
  }, [brandName, requireAuth, toggleBrand]);
  const summary = groupBuy.summary ?? groupBuy.discountInfo ?? "";
  const summarySheetMaxHeight = Math.max(
    280,
    Math.min(
      pageHeight - topInset - spacing.xl,
      pageHeight * SUMMARY_SHEET_MAX_HEIGHT_RATIO,
    ),
  );
  const summarySheetTranslate = useSharedValue(summarySheetMaxHeight);
  const summarySheetDragStartY = useSharedValue(0);
  const summaryCanPullFromScroll = useSharedValue(1);
  const summarySheetHeightForMedia = Math.max(
    1,
    Math.min(
      summarySheetMeasuredHeight || summarySheetMaxHeight,
      summarySheetMaxHeight,
    ),
  );
  const activeSheetMediaTranslate =
    isSearchSheetVisible && searchSheetMetrics
      ? searchSheetMetrics.translateY
      : summarySheetTranslate;
  const activeSheetBaseHeightForMedia =
    isSearchSheetVisible && searchSheetMetrics
      ? Math.max(1, searchSheetMetrics.height)
      : summarySheetHeightForMedia;
  const activeKeyboardHeightForMedia =
    isSearchSheetVisible && searchSheetMetrics
      ? searchSheetMetrics.keyboardHeight
      : null;
  const mediaStageOpenTop = topInset + spacing.sm;
  const minMediaStageHeight = Math.min(
    Math.max(MEDIA_STAGE_MIN_HEIGHT, pageHeight * MEDIA_STAGE_MIN_HEIGHT_RATIO),
    Math.max(1, pageHeight - mediaStageOpenTop - MEDIA_STAGE_MIN_SHEET_SPACE),
  );
  const maxCoveredSheetHeightForMedia = Math.max(
    1,
    pageHeight - mediaStageOpenTop,
  );
  const maxCappedSheetHeightForMedia = Math.max(
    1,
    pageHeight - mediaStageOpenTop - minMediaStageHeight,
  );
  const cappedSheetHeightForMedia = Math.min(
    activeSheetBaseHeightForMedia,
    maxCappedSheetHeightForMedia,
  );
  // Media stage interpolations: 0 (open) -> compact clipped frame, 1 (closed) -> full screen.
  const mediaStageFrameStyle = useAnimatedStyle(() => {
    const keyboardExtra = Math.max(
      0,
      -(activeKeyboardHeightForMedia?.value ?? 0),
    );
    const dynamicSheetHeight = Math.min(
      activeSheetBaseHeightForMedia + keyboardExtra,
      maxCoveredSheetHeightForMedia,
    );
    const dynamicCappedSheetHeight = Math.min(
      dynamicSheetHeight,
      maxCappedSheetHeightForMedia,
    );
    const progress = interpolate(
      activeSheetMediaTranslate.value,
      [0, dynamicCappedSheetHeight],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const frameLeft = interpolate(
      progress,
      [0, 1],
      [MEDIA_STAGE_SIDE_INSET, 0],
      Extrapolation.CLAMP,
    );
    const frameRight = frameLeft;
    const frameTop = interpolate(
      progress,
      [0, 1],
      [mediaStageOpenTop, 0],
      Extrapolation.CLAMP,
    );
    const frameBottom = interpolate(
      progress,
      [0, 1],
      [dynamicCappedSheetHeight, 0],
      Extrapolation.CLAMP,
    );
    const frameWidth = Math.max(1, mediaWidth - frameLeft - frameRight);
    const frameHeight = Math.max(1, pageHeight - frameTop - frameBottom);

    return {
      borderRadius: interpolate(progress, [0, 1], [22, 0], Extrapolation.CLAMP),
      height: frameHeight,
      left: frameLeft,
      top: frameTop,
      width: frameWidth,
    };
  }, [
    activeKeyboardHeightForMedia,
    activeSheetMediaTranslate,
    activeSheetBaseHeightForMedia,
    maxCappedSheetHeightForMedia,
    maxCoveredSheetHeightForMedia,
    mediaStageOpenTop,
    mediaWidth,
    pageHeight,
  ]);
  const mediaStageContentStyle = useAnimatedStyle(() => {
    const keyboardExtra = Math.max(
      0,
      -(activeKeyboardHeightForMedia?.value ?? 0),
    );
    const dynamicSheetHeight = Math.min(
      activeSheetBaseHeightForMedia + keyboardExtra,
      maxCoveredSheetHeightForMedia,
    );
    const dynamicCappedSheetHeight = Math.min(
      dynamicSheetHeight,
      maxCappedSheetHeightForMedia,
    );
    const progress = interpolate(
      activeSheetMediaTranslate.value,
      [0, dynamicCappedSheetHeight],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const frameLeft = interpolate(
      progress,
      [0, 1],
      [MEDIA_STAGE_SIDE_INSET, 0],
      Extrapolation.CLAMP,
    );
    const frameRight = frameLeft;
    const frameTop = interpolate(
      progress,
      [0, 1],
      [mediaStageOpenTop, 0],
      Extrapolation.CLAMP,
    );
    const frameBottom = interpolate(
      progress,
      [0, 1],
      [dynamicCappedSheetHeight, 0],
      Extrapolation.CLAMP,
    );
    const frameWidth = Math.max(1, mediaWidth - frameLeft - frameRight);
    const frameHeight = Math.max(1, pageHeight - frameTop - frameBottom);
    const contentScale = Math.min(
      1,
      Math.max(
        frameWidth / Math.max(1, mediaWidth),
        frameHeight / Math.max(1, pageHeight),
      ),
    );
    const contentTranslateX = (frameWidth - mediaWidth) / 2;
    const contentTranslateY = (frameHeight - pageHeight) / 2;

    return {
      height: pageHeight,
      transform: [
        {
          translateX: contentTranslateX,
        },
        {
          translateY: contentTranslateY,
        },
        {
          scale: contentScale,
        },
      ],
      width: mediaWidth,
    };
  }, [
    activeKeyboardHeightForMedia,
    activeSheetBaseHeightForMedia,
    activeSheetMediaTranslate,
    maxCappedSheetHeightForMedia,
    maxCoveredSheetHeightForMedia,
    mediaStageOpenTop,
    mediaWidth,
    pageHeight,
  ]);
  const summarySheetStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: summarySheetTranslate.value }],
    }),
    [summarySheetTranslate],
  );
  const reelChromeStyle = useAnimatedStyle(() => {
    if (isSearchSheetVisible) {
      return { opacity: 0 };
    }

    const progress = interpolate(
      summarySheetTranslate.value,
      [0, cappedSheetHeightForMedia],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: interpolate(progress, [0, 0.35], [0, 1], Extrapolation.CLAMP),
    };
  }, [cappedSheetHeightForMedia, isSearchSheetVisible, summarySheetTranslate]);

  const resetSummarySheetState = useCallback(() => {
    setSummaryExpanded(false);
    setSummaryVisible(false);
    summaryScrollOffsetRef.current = 0;
    summaryScrollContentHeightRef.current = 0;
    summaryScrollViewportHeightRef.current = 0;
    setSummaryScrollContentHeight(0);
    setSummaryScrollViewportHeight(0);
    setSummaryScrollAtTop(true);
    setSummaryScrollAtBottom(false);
    summaryScrollAtTopRef.current = true;
    summaryScrollAtBottomRef.current = false;
    summaryScrollGestureStartedAtTopRef.current = true;
    summaryCanPullFromScroll.value = 1;
    cancelAnimation(summarySheetTranslate);
    summarySheetTranslate.value = summarySheetMaxHeight;
  }, [summaryCanPullFromScroll, summarySheetMaxHeight, summarySheetTranslate]);

  const snapSummarySheetOpen = useCallback(() => {
    summarySheetTranslate.value = withTiming(0, {
      duration: REELS_SUMMARY_SHEET_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [summarySheetTranslate]);

  const setSummaryOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setSummaryExpanded(true);
        setSummaryVisible(true);
        snapSummarySheetOpen();
      } else {
        summarySheetTranslate.value = withTiming(
          summarySheetMaxHeight,
          {
            duration: REELS_SUMMARY_SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(resetSummarySheetState)();
            }
          },
        );
      }
      onSummarySheetStateChange(isOpen, false);
    },
    [
      onSummarySheetStateChange,
      resetSummarySheetState,
      snapSummarySheetOpen,
      summarySheetMaxHeight,
      summarySheetTranslate,
    ],
  );

  const summarySheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSummaryVisible)
        .activeOffsetY(6)
        .failOffsetX([-24, 24])
        .onBegin(() => {
          summarySheetDragStartY.value = summarySheetTranslate.value;
        })
        .onUpdate((event) => {
          const next =
            summarySheetDragStartY.value + Math.max(0, event.translationY);
          summarySheetTranslate.value = Math.min(next, summarySheetMaxHeight);
        })
        .onEnd((event) => {
          const draggedDown = event.translationY > 12;
          const pastThreshold =
            event.translationY > Math.max(72, summarySheetMaxHeight * 0.28);
          const flickedDown = event.velocityY > 650;
          if (draggedDown && (pastThreshold || flickedDown)) {
            runOnJS(setSummaryOpen)(false);
            return;
          }
          summarySheetTranslate.value = withTiming(0, {
            duration: REELS_SUMMARY_SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [
      isSummaryVisible,
      setSummaryOpen,
      summarySheetDragStartY,
      summarySheetMaxHeight,
      summarySheetTranslate,
    ],
  );

  useEffect(() => {
    if (!isActive && (isSummaryExpanded || isSummaryVisible)) {
      resetSummarySheetState();
      onSummarySheetStateChange(false, true);
    }
  }, [
    isActive,
    isSummaryExpanded,
    isSummaryVisible,
    onSummarySheetStateChange,
    resetSummarySheetState,
  ]);

  // Focused custom overlays consume Back first; returning false delegates the
  // next press to the native stack so Detail itself can pop normally.
  const handleAndroidBack = useCallback(() => {
    if (isSearchSheetVisible) {
      onCloseSearchSheet?.();
      return true;
    }
    if (isSummaryVisible) {
      setSummaryOpen(false);
      return true;
    }
    return false;
  }, [
    isSearchSheetVisible,
    isSummaryVisible,
    onCloseSearchSheet,
    setSummaryOpen,
  ]);
  useFocusedAndroidBackHandler(handleAndroidBack, isActive);

  useEffect(() => {
    setActiveMediaIndex(0);
    resetSummarySheetState();
    onSummarySheetStateChange(false, true);
  }, [groupBuy.id, onSummarySheetStateChange, resetSummarySheetState]);

  const canSwipeReelFromSummaryOffset = useCallback(
    (
      offsetY: number,
      viewportHeight = summaryScrollViewportHeightRef.current,
      contentHeight = summaryScrollContentHeightRef.current,
    ) => {
      if (viewportHeight <= 0 || contentHeight <= 0) return false;
      if (contentHeight <= viewportHeight + 2) return true;

      const maxOffsetY = Math.max(0, contentHeight - viewportHeight);
      return offsetY >= maxOffsetY - 2;
    },
    [],
  );

  const summaryContentFitsViewport =
    summaryScrollContentHeight > 0 &&
    summaryScrollContentHeight <= summaryScrollViewportHeight + 2;

  const canPullSummarySheetFromScroll =
    isSummaryScrollAtTop || summaryContentFitsViewport;

  const summaryScrollPullGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSummaryVisible && canPullSummarySheetFromScroll)
        .activeOffsetY(4)
        .failOffsetX([-24, 24])
        .onBegin(() => {
          summarySheetDragStartY.value = summarySheetTranslate.value;
        })
        .onUpdate((event) => {
          if (summaryCanPullFromScroll.value > 0 && event.translationY > 0) {
            const next = summarySheetDragStartY.value + event.translationY;
            summarySheetTranslate.value = Math.min(next, summarySheetMaxHeight);
          }
        })
        .onEnd((event) => {
          if (summaryCanPullFromScroll.value <= 0 || event.translationY <= 0) {
            summarySheetTranslate.value = withTiming(0, {
              duration: REELS_SUMMARY_SHEET_ANIMATION_MS,
              easing: Easing.out(Easing.cubic),
            });
            return;
          }

          const draggedDown = event.translationY > 12;
          const pastThreshold =
            event.translationY > SUMMARY_EDGE_DISMISS_DISTANCE;
          const flickedDown = event.velocityY > 650;
          if (draggedDown && (pastThreshold || flickedDown)) {
            runOnJS(setSummaryOpen)(false);
            return;
          }
          summarySheetTranslate.value = withTiming(0, {
            duration: REELS_SUMMARY_SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [
      canPullSummarySheetFromScroll,
      isSummaryVisible,
      setSummaryOpen,
      summaryCanPullFromScroll,
      summarySheetDragStartY,
      summarySheetMaxHeight,
      summarySheetTranslate,
    ],
  );

  const handleSummaryScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const nextOffset = event.nativeEvent.contentOffset.y;
      const isPullingPastTop =
        nextOffset < 0 &&
        (summaryScrollGestureStartedAtTopRef.current ||
          summaryContentFitsViewport);
      const canSwipeReel = canSwipeReelFromSummaryOffset(nextOffset);
      const nextAtTop = nextOffset <= SUMMARY_SCROLL_TOP_EPSILON;
      const nextCanPull = nextAtTop || summaryContentFitsViewport;
      const previousAtTop = summaryScrollAtTopRef.current;
      const previousAtBottom = summaryScrollAtBottomRef.current;
      summaryScrollOffsetRef.current = nextOffset;
      summaryScrollAtTopRef.current = nextAtTop;
      summaryScrollAtBottomRef.current = canSwipeReel;
      summaryCanPullFromScroll.value = nextCanPull ? 1 : 0;
      if (isPullingPastTop) {
        const nextSheetOffset = Math.min(-nextOffset, summarySheetMaxHeight);
        summarySheetTranslate.value = nextSheetOffset;
      }
      if (previousAtTop !== nextAtTop) {
        setSummaryScrollAtTop(nextAtTop);
      }
      if (previousAtBottom !== canSwipeReel) {
        setSummaryScrollAtBottom(canSwipeReel);
        onSummarySheetStateChange(true, canSwipeReel);
      }
    },
    [
      canSwipeReelFromSummaryOffset,
      isSummaryExpanded,
      onSummarySheetStateChange,
      summaryContentFitsViewport,
      summaryCanPullFromScroll,
      summarySheetMaxHeight,
      summarySheetTranslate,
    ],
  );

  const handleSummaryScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffset = event.nativeEvent.contentOffset.y;
      const startedAtTop = nextOffset <= SUMMARY_SCROLL_TOP_EPSILON;
      summaryScrollGestureStartedAtTopRef.current = startedAtTop;
    },
    [],
  );

  const handleSummaryScrollLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      summaryScrollViewportHeightRef.current = nextHeight;
      setSummaryScrollViewportHeight(nextHeight);
      if (isSummaryExpanded) {
        const canSwipeReel = canSwipeReelFromSummaryOffset(
          summaryScrollOffsetRef.current,
          nextHeight,
        );
        const nextContentFitsViewport =
          summaryScrollContentHeightRef.current > 0 &&
          summaryScrollContentHeightRef.current <= nextHeight + 2;
        const nextCanPull =
          summaryScrollAtTopRef.current || nextContentFitsViewport;
        summaryCanPullFromScroll.value = nextCanPull ? 1 : 0;
        summaryScrollAtBottomRef.current = canSwipeReel;
        setSummaryScrollAtBottom(canSwipeReel);
        onSummarySheetStateChange(true, canSwipeReel);
      }
    },
    [
      canSwipeReelFromSummaryOffset,
      isSummaryExpanded,
      onSummarySheetStateChange,
      summaryCanPullFromScroll,
    ],
  );

  const handleSummarySheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.min(
        event.nativeEvent.layout.height,
        summarySheetMaxHeight,
      );
      setSummarySheetMeasuredHeight((current) =>
        Math.abs(current - nextHeight) < 1 ? current : nextHeight,
      );
    },
    [summarySheetMaxHeight],
  );

  const handleSummaryContentSizeChange = useCallback(
    (_width: number, height: number) => {
      summaryScrollContentHeightRef.current = height;
      setSummaryScrollContentHeight(height);
      if (isSummaryExpanded) {
        const canSwipeReel = canSwipeReelFromSummaryOffset(
          summaryScrollOffsetRef.current,
          undefined,
          height,
        );
        const nextContentFitsViewport =
          height <= summaryScrollViewportHeightRef.current + 2;
        const nextCanPull =
          summaryScrollAtTopRef.current || nextContentFitsViewport;
        summaryCanPullFromScroll.value = nextCanPull ? 1 : 0;
        summaryScrollAtBottomRef.current = canSwipeReel;
        setSummaryScrollAtBottom(canSwipeReel);
        onSummarySheetStateChange(true, canSwipeReel);
      }
    },
    [
      canSwipeReelFromSummaryOffset,
      isSummaryExpanded,
      onSummarySheetStateChange,
      summaryCanPullFromScroll,
    ],
  );

  // Keep edge bounces enabled so the touch can hand off at both scroll ends.
  const summaryBounces =
    isSummaryExpanded &&
    (isSummaryScrollAtTop ||
      isSummaryScrollAtBottom ||
      summaryContentFitsViewport);

  const handleSummaryScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const { y } = event.nativeEvent.contentOffset;
      const draggedPastTop =
        y <= -SUMMARY_EDGE_DISMISS_DISTANCE &&
        (summaryScrollGestureStartedAtTopRef.current ||
          summaryContentFitsViewport);
      if (draggedPastTop) {
        setSummaryOpen(false);
      }
    },
    [isSummaryExpanded, setSummaryOpen, summaryContentFitsViewport],
  );

  const handleShare = async () => {
    const productName = groupBuy.productName ?? "공동구매";
    const sellerSuffix = sellerHandle ? ` (${sellerHandle})` : "";
    try {
      await Share.share({
        message: `${productName}${sellerSuffix}\n${groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl}`,
      });
    } catch {
      Alert.alert("오류", "공유에 실패했습니다.");
    }
  };

  const handleOpenLink = () => {
    if (isExpired) {
      return;
    }

    const rawUrl = groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl;
    const trimmedUrl = rawUrl?.trim();
    const openUrl = trimmedUrl
      ? /^https?:\/\//i.test(trimmedUrl)
        ? trimmedUrl
        : `https://${trimmedUrl.replace(/^\/+/, "")}`
      : null;

    if (!openUrl) {
      Alert.alert("링크 없음", "열 수 있는 구매 링크가 없습니다.");
      return;
    }

    try {
      void Linking.openURL(openUrl).catch(() => {
        Alert.alert("오류", "구매 링크를 열 수 없습니다.");
      });
    } catch {
      Alert.alert("오류", "구매 링크를 열 수 없습니다.");
    }
  };

  const visibleDots = getVisibleDotIndexes(mediaItems.length, activeMediaIndex);
  const mediaListExtraData = useMemo(
    () => ({
      activeMediaIndex,
      isActive,
      muted,
      playbackAllowed,
      replayKey,
      shouldPreloadVideo,
    }),
    [
      activeMediaIndex,
      isActive,
      muted,
      playbackAllowed,
      replayKey,
      shouldPreloadVideo,
    ],
  );
  const handleActiveMediaPlaybackStateChange = useCallback(
    (isPlaying: boolean) => onPlaybackStateChange?.(groupBuy.id, isPlaying),
    [groupBuy.id, onPlaybackStateChange],
  );

  const renderMediaItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const mediaActive =
        isActive && playbackAllowed && index === activeMediaIndex;
      const shouldMountVideo =
        mediaActive ||
        (shouldPreloadVideo && index === activeMediaIndex) ||
        (isActive && Math.abs(index - activeMediaIndex) <= 1);
      const thumbnailUrl = item.thumbnailUrl ?? groupBuy.thumbnailUrl ?? null;

      return (
        <View style={[s.mediaPane, { width: mediaWidth, height: pageHeight }]}>
          {item.isVideo ? (
            shouldMountVideo ? (
              <VideoSlide
                key={item.url}
                url={item.url}
                isActive={mediaActive}
                replayKey={replayKey}
                thumbnailUrl={thumbnailUrl}
                muted={muted}
                onMutedChange={onMutedChange}
                onPlaybackStateChange={
                  mediaActive ? handleActiveMediaPlaybackStateChange : undefined
                }
                s={s}
              />
            ) : thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={s.mediaFill}
                resizeMode="contain"
              />
            ) : (
              <View style={s.videoPlaceholder}>
                <SText variant="body" style={s.videoPlaceholderText}>
                  동영상
                </SText>
              </View>
            )
          ) : (
            <Image
              source={{ uri: item.url }}
              style={s.mediaFill}
              resizeMode="contain"
            />
          )}
        </View>
      );
    },
    [
      activeMediaIndex,
      groupBuy.thumbnailUrl,
      handleActiveMediaPlaybackStateChange,
      isActive,
      mediaWidth,
      muted,
      onMutedChange,
      pageHeight,
      playbackAllowed,
      s,
      shouldPreloadVideo,
      replayKey,
    ],
  );

  return (
    <View style={[s.reelPage, { height: pageHeight }]}>
      <Reanimated.View style={[s.mediaStage, mediaStageFrameStyle]}>
        <Reanimated.View style={[s.mediaStageContent, mediaStageContentStyle]}>
          {mediaItems.length > 0 ? (
            <View style={s.mediaViewport}>
              <FlashList
                data={mediaItems}
                extraData={mediaListExtraData}
                horizontal
                pagingEnabled
                snapToAlignment="start"
                snapToInterval={mediaWidth}
                keyExtractor={(item, index) => `${item.url}-${index}`}
                renderItem={renderMediaItem}
                showsHorizontalScrollIndicator={false}
                style={s.mediaScroller}
                decelerationRate="fast"
                disableIntervalMomentum
                drawDistance={mediaWidth}
                maxItemsInRecyclePool={2}
                maintainVisibleContentPosition={{ disabled: true }}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.x / mediaWidth,
                  );
                  if (
                    nextIndex !== activeMediaIndex &&
                    nextIndex >= 0 &&
                    nextIndex < mediaItems.length
                  ) {
                    setActiveMediaIndex(nextIndex);
                  }
                }}
              />
            </View>
          ) : (
            <View style={s.emptyMedia}>
              <SText variant="body" style={s.emptyMediaText}>
                미디어 없음
              </SText>
            </View>
          )}
        </Reanimated.View>
      </Reanimated.View>

      <Reanimated.View
        pointerEvents={
          isSummaryExpanded || isSearchSheetVisible ? "none" : "auto"
        }
        style={[
          s.topBar,
          { paddingTop: topInset + spacing.sm },
          reelChromeStyle,
        ]}
      >
        {showBackButton ? (
          <BackButton
            color="#FFFFFF"
            onPress={onBack}
            style={s.topIconButton}
            testID="detail-back-button"
          />
        ) : (
          <View style={s.topIconButton} />
        )}
        <View style={s.reelsTitleRow}>
          <SText variant="cardTitle" style={s.reelsTitle}>
            릴스
          </SText>
        </View>
        <View style={s.topIconButton} />
      </Reanimated.View>

      {mediaItems.length > 1 ? (
        <Reanimated.View
          style={[s.mediaDots, { top: topInset + 62 }, reelChromeStyle]}
        >
          {visibleDots.map((index) => (
            <View
              key={index}
              style={[
                s.mediaDot,
                index === activeMediaIndex && s.mediaDotActive,
                mediaItems.length > MAX_VISIBLE_DOTS &&
                  index === visibleDots[0] &&
                  activeMediaIndex > 2 &&
                  s.mediaDotFaded,
                mediaItems.length > MAX_VISIBLE_DOTS &&
                  index === visibleDots[visibleDots.length - 1] &&
                  activeMediaIndex < mediaItems.length - 3 &&
                  s.mediaDotFaded,
              ]}
            />
          ))}
        </Reanimated.View>
      ) : null}

      <>
        <Reanimated.View
          pointerEvents={
            isSummaryExpanded || isSearchSheetVisible ? "none" : "auto"
          }
          style={[
            s.rightRail,
            { bottom: bottomInset + bottomChromeOffset + 104 },
            reelChromeStyle,
          ]}
        >
          <ReelAction
            icon={
              <Ionicons
                name={
                  isAuthenticated && isBookmarked(groupBuy.id) ? "bookmark" : "bookmark-outline"
                }
                size={26}
                color={isAuthenticated && isBookmarked(groupBuy.id) ? colors.accent : "#FFFFFF"}
              />
            }
            label={isAuthenticated && isBookmarked(groupBuy.id) ? "북마크됨" : "북마크"}
            onPress={handleBookmarkPress}
            s={s}
          />
          <ReelAction
            icon={<Ionicons name="link-outline" size={26} color="#FFFFFF" />}
            label="링크"
            onPress={handleOpenLink}
            s={s}
          />
          <ReelAction
            icon={
              <Ionicons name="share-social-outline" size={26} color="#FFFFFF" />
            }
            label="공유"
            onPress={handleShare}
            s={s}
          />
          <ReelAction
            icon={
              <Ionicons
                name={
                  notificationEnabled
                    ? "notifications"
                    : "notifications-outline"
                }
                size={26}
                color={notificationEnabled ? colors.accent : "#FFFFFF"}
              />
            }
            label={notificationLabel}
            onPress={handleNotificationPress}
            s={s}
            testID="detail-notification-toggle"
          />
          <ReelPurchaseAction onPress={handleOpenLink} s={s} />
        </Reanimated.View>

        <Reanimated.View
          pointerEvents={
            isSummaryExpanded || isSearchSheetVisible ? "none" : "auto"
          }
          style={[
            s.bottomInfo,
            { paddingBottom: bottomInset + bottomChromeOffset + spacing.lg },
            reelChromeStyle,
          ]}
        >
          <View style={s.bottomInfoScrim} pointerEvents="none" />
          {sellerHandle ? (
            <View style={s.sellerRow}>
              <View style={s.avatar}>
                <SText variant="caption" style={s.avatarText}>
                  {sellerName.slice(0, 1).toUpperCase()}
                </SText>
              </View>
              <SText variant="cardTitle" style={s.sellerName} numberOfLines={1}>
                {sellerHandle}
              </SText>
            </View>
          ) : null}

          <View style={s.followTargetRow}>
            {sellerName ? (
              <Pressable
                accessibilityLabel={`@${sellerName} 인플루언서 알림 ${isInfluencerFollowed ? "해제" : "설정"}`}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: isInfluencerFollowed,
                  disabled: followControlsDisabled,
                }}
                disabled={followControlsDisabled}
                onPress={handleInfluencerFollowPress}
                style={({ pressed }) => [
                  s.followTargetChip,
                  isInfluencerFollowed && s.followTargetChipActive,
                  pressed && s.pressed,
                ]}
                testID="follow-influencer-notifications"
              >
                <Ionicons
                  color={isInfluencerFollowed ? colors.accent : "#FFFFFF"}
                  name={
                    isInfluencerFollowed
                      ? "notifications"
                      : "notifications-outline"
                  }
                  size={14}
                />
                <SText
                  style={[
                    s.followTargetText,
                    isInfluencerFollowed && s.followTargetTextActive,
                  ]}
                  variant="caption"
                >
                  인플루언서 알림
                </SText>
              </Pressable>
            ) : null}
            {brandName ? (
              <Pressable
                accessibilityLabel={`${brandName} 브랜드 알림 ${isBrandFollowed ? "해제" : "설정"}`}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: isBrandFollowed,
                  disabled: followControlsDisabled,
                }}
                disabled={followControlsDisabled}
                onPress={handleBrandFollowPress}
                style={({ pressed }) => [
                  s.followTargetChip,
                  isBrandFollowed && s.followTargetChipActive,
                  pressed && s.pressed,
                ]}
                testID="follow-brand-notifications"
              >
                <Ionicons
                  color={isBrandFollowed ? colors.accent : "#FFFFFF"}
                  name={isBrandFollowed ? "pricetag" : "pricetag-outline"}
                  size={14}
                />
                <SText
                  style={[
                    s.followTargetText,
                    isBrandFollowed && s.followTargetTextActive,
                  ]}
                  variant="caption"
                >
                  브랜드 알림
                </SText>
              </Pressable>
            ) : null}
          </View>

          <SText variant="cardTitle" style={s.productName} numberOfLines={2}>
            {groupBuy.productName ?? "제품명 미확인"}
          </SText>
          <PriceText
            color="#FFFFFF"
            priceKrw={groupBuy.priceKrw}
            style={s.productPrice}
          />

          {summary ? (
            <Pressable
              accessibilityLabel="요약 자세히 보기"
              accessibilityRole="button"
              onPress={() => setSummaryOpen(true)}
              style={({ pressed }) => [s.summaryPreview, pressed && s.pressed]}
            >
              <SText variant="body" style={s.summary} numberOfLines={1}>
                {summary}
              </SText>
              <SText variant="caption" style={s.summaryMore}>
                더 보기
              </SText>
            </Pressable>
          ) : null}

          <View style={s.metaRow}>
            <View
              style={[
                s.metaPill,
                isUrgent && !isExpired && s.metaPillUrgent,
                isExpired && s.metaPillExpired,
              ]}
            >
              <SText variant="caption" style={s.metaPillText}>
                {isExpired ? "마감" : isUrgent ? "마감 임박" : deadlineLabel}
              </SText>
            </View>
            {categoryLabel ? (
              <View style={s.metaPill}>
                <SText variant="caption" style={s.metaPillText}>
                  {categoryLabel}
                </SText>
              </View>
            ) : null}
          </View>
        </Reanimated.View>
      </>

      {summary && (isActive || isSummaryVisible) ? (
        <View
          accessibilityElementsHidden={!isSummaryVisible}
          importantForAccessibility={
            isSummaryVisible ? "auto" : "no-hide-descendants"
          }
          pointerEvents={isSummaryVisible ? "box-none" : "none"}
          style={s.summaryOverlay}
          testID="reels-summary-sheet-overlay"
        >
          {isSummaryVisible ? (
            <Pressable
              accessibilityLabel="요약 닫기"
              accessibilityRole="button"
              onPress={() => setSummaryOpen(false)}
              style={s.summaryBackdrop}
              testID="reels-summary-sheet-backdrop"
            />
          ) : null}
          <Reanimated.View
            accessibilityElementsHidden={!isSummaryVisible}
            importantForAccessibility={
              isSummaryVisible ? "auto" : "no-hide-descendants"
            }
            onLayout={handleSummarySheetLayout}
            style={[
              s.summarySheet,
              {
                maxHeight: summarySheetMaxHeight,
                paddingBottom: bottomInset + spacing.lg,
              },
              summarySheetStyle,
            ]}
          >
            <GestureDetector gesture={summarySheetPanGesture}>
              <View style={s.summaryDragArea}>
                <View style={s.summaryHandle}>
                  <View style={s.summaryHandleBar} />
                </View>
                <View style={s.summarySheetHeader}>
                  <View style={s.summarySheetSeller}>
                    {sellerHandle ? (
                      <View style={s.summarySheetAvatar}>
                        <SText variant="caption" style={s.avatarText}>
                          {sellerName.slice(0, 1).toUpperCase()}
                        </SText>
                      </View>
                    ) : null}
                    <View style={s.summarySheetTitleBlock}>
                      {sellerHandle ? (
                        <SText
                          variant="cardTitle"
                          style={s.summarySheetSellerName}
                          numberOfLines={1}
                        >
                          {sellerHandle}
                        </SText>
                      ) : null}
                      <SText
                        variant="caption"
                        style={s.summarySheetProductName}
                        numberOfLines={1}
                      >
                        {groupBuy.productName ?? "제품명 미확인"}
                      </SText>
                      <PriceText
                        color="#FFFFFF"
                        priceKrw={groupBuy.priceKrw}
                        style={s.summarySheetProductPrice}
                      />
                    </View>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel={isExpired ? "마감된 공구" : "구매 링크"}
                  accessibilityRole="button"
                  onPress={handleOpenLink}
                  style={({ pressed }) => [
                    s.summarySheetBuyButton,
                    isExpired && s.summarySheetBuyButtonExpired,
                    pressed && !isExpired && s.pressed,
                  ]}
                >
                  <SText variant="caption" style={s.summarySheetBuyButtonText}>
                    {isExpired ? "마감" : "구매 링크"}
                  </SText>
                </Pressable>
              </View>
            </GestureDetector>
            <GestureDetector gesture={summaryScrollPullGesture}>
              <GestureScrollView
                alwaysBounceVertical={summaryBounces}
                bounces={summaryBounces}
                nestedScrollEnabled
                onContentSizeChange={handleSummaryContentSizeChange}
                onLayout={handleSummaryScrollLayout}
                onScroll={handleSummaryScroll}
                onScrollBeginDrag={handleSummaryScrollBeginDrag}
                onScrollEndDrag={handleSummaryScrollEndDrag}
                overScrollMode="always"
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                style={s.summaryScroll}
              >
                <SText variant="body" style={s.summarySheetText}>
                  {summary}
                </SText>
                {showDetailAd && isActive && isSummaryVisible ? (
                  <View style={s.summarySheetAd}>
                    <NativeAdCard
                      placement="detail"
                      testID="detail-native-ad"
                    />
                  </View>
                ) : null}
              </GestureScrollView>
            </GestureDetector>
          </Reanimated.View>
        </View>
      ) : null}
    </View>
  );
}

export const ProductReelPage = memo(ProductReelPageComponent);

function NotificationLinkedDetail({
  groupBuyId,
  navigation,
}: {
  groupBuyId: string;
  navigation: DetailScreenProps["navigation"];
}) {
  const { colors } = useTheme();
  const {
    data,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["group-buy", groupBuyId],
    queryFn: () => fetchGroupBuyById(groupBuyId),
  });

  if (data) {
    return <DetailScreenContent groupBuy={data} navigation={navigation} />;
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.bg, flex: 1 }}>
      <BackButton onPress={() => navigation.goBack()} />
      <View
        style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}
        testID={isError ? "notification-linked-detail-error" : "notification-linked-detail-loading"}
      >
        {isError ? (
          <AsyncStateNotice
            isRetrying={isFetching}
            message="알림이 가리킨 공구를 다시 확인해주세요."
            onRetry={() => refetch()}
            testID="notification-linked-detail-error-notice"
            title="공구 상세를 불러오지 못했어요"
            variant="error"
          />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <SText variant="body">공구 상세를 불러오는 중이에요</SText>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export function DetailScreen({ route, navigation }: DetailScreenProps) {
  if ("groupBuy" in route.params && route.params.groupBuy) {
    return (
      <DetailScreenContent
        groupBuy={route.params.groupBuy}
        navigation={navigation}
      />
    );
  }
  return (
    <NotificationLinkedDetail
      groupBuyId={route.params.groupBuyId}
      navigation={navigation}
    />
  );
}

function DetailScreenContent({
  groupBuy,
  navigation,
}: {
  groupBuy: GroupBuy;
  navigation: DetailScreenProps["navigation"];
}) {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const { recordView } = useRecentViews();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const verticalPagerRef = useRef<PagerView>(null);
  const hasDepartedRouteRef = useRef(false);
  useEffect(() => {
    hasDepartedRouteRef.current = false;
  }, [groupBuy.id]);
  const [summarySheetGate, setSummarySheetGate] = useState({
    isOpen: false,
    canSwipeReel: true,
  });
  const { isScreenFocused, isAppActive, isAppFocused, isPlaybackActive } =
    usePlaybackLifecycle();
  const [isActivePlayerPlaying, setActivePlayerPlaying] = useState(false);
  const [isSearchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [searchSheetMeasuredHeight, setSearchSheetMeasuredHeight] = useState(0);
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const searchSheetMaxHeight = Math.max(
    280,
    Math.min(
      screenHeight - insets.top - spacing.xl,
      screenHeight * SEARCH_SHEET_MAX_HEIGHT_RATIO,
    ),
  );
  const searchSheetTranslate = useSharedValue(searchSheetMaxHeight);
  const searchSheetHeightForMedia = Math.max(
    1,
    Math.min(
      searchSheetMeasuredHeight || searchSheetMaxHeight,
      Math.max(1, screenHeight - (insets.top + 64)),
    ),
  );
  const searchSheetMetrics = useMemo(
    () =>
      isSearchSheetVisible
        ? {
            height: searchSheetHeightForMedia,
            keyboardHeight,
            translateY: searchSheetTranslate,
          }
        : null,
    [
      isSearchSheetVisible,
      keyboardHeight,
      searchSheetHeightForMedia,
      searchSheetTranslate,
    ],
  );

  const { data: groupBuys } = useQuery({
    queryKey: ["group-buys"],
    queryFn: fetchGroupBuys,
  });

  const reelItems = useMemo(
    () => getReelItems(groupBuy, groupBuys),
    [groupBuy, groupBuys],
  );
  const initialReelIndex = useMemo(
    () => getInitialReelIndex(groupBuy, reelItems),
    [groupBuy.id, reelItems],
  );
  const [activeProductId, setActiveProductId] = useState(groupBuy.id);
  const activeProductIndex = useMemo(() => {
    const currentIndex = reelItems.findIndex(
      (item) => item.id === activeProductId,
    );
    return currentIndex >= 0 ? currentIndex : initialReelIndex;
  }, [activeProductId, initialReelIndex, reelItems]);
  // Interleave native-ad pages into the detail pager (same pattern as Reels).
  // When ads are disabled, insertReelsAdSlots returns a 1:1 content-only feed.
  const { enabled: adsEnabled, isReady: adsReady, nativeUnitIds } = useAds();
  const [detailAdsUnavailable, setDetailAdsUnavailable] = useState(false);
  const canShowDetailAds =
    adsEnabled &&
    adsReady &&
    Boolean(nativeUnitIds.detail) &&
    !detailAdsUnavailable;
  const feedItems = useMemo(
    () =>
      insertReelsAdSlots(reelItems, {
        boundFirstGapToFeed: true,
        enabled: canShowDetailAds,
        random: seedAdRandomFromIds(reelItems.map((item) => item.id)),
      }),
    [canShowDetailAds, reelItems],
  );
  // Map the active organic product index to its position in the ad-interleaved
  // feed, so the pager opens on the right page even when ad breaks precede it.
  const activeDisplayIndex = useMemo(() => {
    let organicCount = 0;
    for (let i = 0; i < feedItems.length; i++) {
      const entry = feedItems[i];
      if (isReelsContentItem(entry)) {
        if (organicCount === activeProductIndex) return i;
        organicCount++;
      }
    }
    return initialReelIndex;
  }, [feedItems, activeProductIndex, initialReelIndex]);
  const detailPagerKey = useMemo(
    () => feedItems.map((entry) => entry.key).join("|"),
    [feedItems],
  );
  const [activePagerIndex, setActivePagerIndex] = useState(activeDisplayIndex);
  const [isOnAdPage, setIsOnAdPage] = useState(false);
  const [canonicalAlignedRouteId, setCanonicalAlignedRouteId] = useState<
    string | null
  >(null);
  const feedItemsRef = useRef(feedItems);
  const activePagerIndexRef = useRef(activePagerIndex);
  feedItemsRef.current = feedItems;
  activePagerIndexRef.current = activePagerIndex;
  const handleDetailAdLoadStateChange = useCallback(
    (status: NativeAdLoadStatus) => {
      if (status !== "unavailable") return;

      const currentFeed = feedItemsRef.current;
      const selectedIndex = activePagerIndexRef.current;
      const selectedEntry = currentFeed[selectedIndex];
      if (selectedEntry && !isReelsContentItem(selectedEntry)) {
        const nextEntry = currentFeed
          .slice(selectedIndex + 1)
          .find(isReelsContentItem);
        const fallbackEntry = [...currentFeed.slice(0, selectedIndex)]
          .reverse()
          .find(isReelsContentItem);
        const recoveryEntry = nextEntry ?? fallbackEntry;
        if (recoveryEntry) setActiveProductId(recoveryEntry.content.id);
        setIsOnAdPage(false);
      }
      setDetailAdsUnavailable(true);
    },
    [],
  );
  // No product is "active" while the user rests on a sponsored page, so
  // playback tracking and deep-view timers pause until they swipe back.
  const activeGroupBuy = isOnAdPage
    ? groupBuy
    : reelItems[activeProductIndex] ?? groupBuy;
  const hasCanonicalRouteGroupBuy = Boolean(
    groupBuys?.some((item) => item.id === groupBuy.id),
  );
  const hasCanonicalActiveGroupBuy = Boolean(
    groupBuys?.some((item) => item.id === activeGroupBuy.id),
  );
  const hasPlayableActiveMedia = hasPlayableVideoMedia(activeGroupBuy);
  const activeGroupBuyIdRef = useRef(activeGroupBuy.id);
  useLayoutEffect(() => {
    activeGroupBuyIdRef.current = activeGroupBuy.id;
  }, [activeGroupBuy.id]);
  const handlePlaybackStateChange = useCallback(
    (itemId: string, isPlaying: boolean) => {
      if (itemId !== activeGroupBuyIdRef.current) return;
      setActivePlayerPlaying((current) =>
        current === isPlaying ? current : isPlaying,
      );
    },
    [],
  );
  const searchItems = useMemo(() => {
    const seen = new Set<string>();
    const source = [...reelItems, ...(groupBuys ?? [])];
    return source.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [groupBuys, reelItems]);
  const filteredSearchItems = useMemo(() => {
    const normalized = normalizeForSearch(debouncedQuery);
    const source = searchItems.length ? searchItems : [groupBuy];
    if (!normalized) return source.slice(0, 20);
    return source
      .filter((item) => getSearchText(item).includes(normalized))
      .slice(0, 30);
  }, [groupBuy, searchItems, debouncedQuery]);
  useEffect(() => {
    if (
      isOnAdPage ||
      canonicalAlignedRouteId !== groupBuy.id ||
      !hasCanonicalActiveGroupBuy
    )
      return;
    recordView(activeGroupBuy);
  }, [
    activeGroupBuy,
    canonicalAlignedRouteId,
    groupBuy.id,
    hasCanonicalActiveGroupBuy,
    isOnAdPage,
    recordView,
  ]);
  useEffect(() => {
    setActivePlayerPlaying(false);
  }, [
    activeGroupBuy.id,
    isPlaybackActive,
  ]);
  // ── Deep view tracking: count a view only after 30s of continuous watch ──
  const deepViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackEligibleRef = useRef(false);
  useEffect(() => {
    if (deepViewTimerRef.current) {
      clearTimeout(deepViewTimerRef.current);
      deepViewTimerRef.current = null;
    }
    const overlayOpen = summarySheetGate.isOpen || isSearchSheetVisible;
    const playbackEligible = isPlaybackEligible({
      screenFocused: isScreenFocused,
      appActive: isAppActive && isAppFocused,
      overlayOpen,
      playerPlaying: isActivePlayerPlaying,
      hasPlayableMedia: hasPlayableActiveMedia,
    });
    playbackEligibleRef.current = playbackEligible;
    if (playbackEligible && activeGroupBuy) {
      const id = activeGroupBuy.id;
      deepViewTimerRef.current = setTimeout(() => {
        if (!playbackEligibleRef.current) return;
        void Promise.resolve(logDeepView(id)).catch(() => undefined);
      }, DEEP_VIEW_THRESHOLD_MS);
    }
    return () => {
      if (deepViewTimerRef.current) {
        clearTimeout(deepViewTimerRef.current);
        deepViewTimerRef.current = null;
      }
    };
  }, [
    activeGroupBuy,
    hasPlayableActiveMedia,
    isActivePlayerPlaying,
    isAppActive,
    isAppFocused,
    isScreenFocused,
    isSearchSheetVisible,
    summarySheetGate.isOpen,
  ]);
  const handleSummarySheetStateChange = useCallback(
    (isOpen: boolean, canSwipeReel: boolean) => {
      setSummarySheetGate((current) =>
        current.isOpen === isOpen && current.canSwipeReel === canSwipeReel
          ? current
          : { isOpen, canSwipeReel },
      );
    },
    [],
  );

  useEffect(() => {
    if (!isSearchSheetVisible) {
      searchSheetTranslate.value = searchSheetMaxHeight;
    }
  }, [isSearchSheetVisible, searchSheetMaxHeight, searchSheetTranslate]);

  const openSearchSheet = useCallback(() => {
    setSearchSheetVisible(true);
    cancelAnimation(searchSheetTranslate);
    searchSheetTranslate.value = searchSheetMaxHeight;
    searchSheetTranslate.value = withTiming(0, {
      duration: BOTTOM_SHEET_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const closeSearchSheet = useCallback(() => {
    Keyboard.dismiss();
    searchSheetTranslate.value = withTiming(
      searchSheetMaxHeight,
      {
        duration: BOTTOM_SHEET_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setSearchSheetVisible)(false);
        }
      },
    );
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const resetSearchSheetClosed = useCallback(() => {
    Keyboard.dismiss();
    cancelAnimation(searchSheetTranslate);
    searchSheetTranslate.value = searchSheetMaxHeight;
    setSearchSheetVisible(false);
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const handleSearchSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.min(
        event.nativeEvent.layout.height,
        searchSheetMaxHeight,
      );
      setSearchSheetMeasuredHeight((current) =>
        Math.abs(current - nextHeight) < 1 ? current : nextHeight,
      );
    },
    [searchSheetMaxHeight],
  );

  useEffect(() => {
    setSummarySheetGate({ isOpen: false, canSwipeReel: true });
  }, [activeProductIndex]);

  useEffect(() => {
    if (
      !hasCanonicalRouteGroupBuy ||
      canonicalAlignedRouteId === groupBuy.id
    ) {
      return;
    }
    if (!hasDepartedRouteRef.current) {
      const routeDisplayIndex = feedItems.findIndex(
        (entry) =>
          isReelsContentItem(entry) && entry.content.id === groupBuy.id,
      );
      if (routeDisplayIndex < 0) return;
      setActiveProductId(groupBuy.id);
      setActivePagerIndex(routeDisplayIndex);
      setIsOnAdPage(false);
      verticalPagerRef.current?.setPageWithoutAnimation?.(routeDisplayIndex);
    }
    setCanonicalAlignedRouteId(groupBuy.id);
  }, [
    canonicalAlignedRouteId,
    feedItems,
    groupBuy.id,
    hasCanonicalRouteGroupBuy,
  ]);

  useEffect(() => {
    const selectedEntry = feedItems[activePagerIndex];
    if (
      isOnAdPage &&
      selectedEntry &&
      !isReelsContentItem(selectedEntry)
    ) {
      return;
    }
    setIsOnAdPage(false);
    setActivePagerIndex(activeDisplayIndex);
  }, [activeDisplayIndex, activePagerIndex, feedItems, isOnAdPage]);

  const handleSelectSearchResult = useCallback(
    (item: GroupBuy) => {
      const nextIndex = reelItems.findIndex((entry) => entry.id === item.id);
      resetSearchSheetClosed();
      setSearchQuery("");
      setSummarySheetGate({ isOpen: false, canSwipeReel: true });
      if (nextIndex >= 0) {
        if (item.id !== groupBuy.id) hasDepartedRouteRef.current = true;
        setActiveProductId(item.id);
        const nextDisplayIndex = feedItems.findIndex(
          (entry) => isReelsContentItem(entry) && entry.content.id === item.id,
        );
        const targetDisplayIndex =
          nextDisplayIndex >= 0 ? nextDisplayIndex : activeDisplayIndex;
        setActivePagerIndex(targetDisplayIndex);
        setIsOnAdPage(false);
        verticalPagerRef.current?.setPage?.(
          targetDisplayIndex,
        );
        return;
      }
      navigation.push("Detail", { groupBuy: item });
    },
    [
      navigation,
      reelItems,
      feedItems,
      activeDisplayIndex,
      groupBuy.id,
      resetSearchSheetClosed,
    ],
  );
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

 const renderReelItem = useCallback(
   ({ item, index }: { item: GroupBuy; index: number }) => (
     <ProductReelPage
       key={item.id}
       groupBuy={item}
        isActive={isScreenFocused && index === activeProductIndex && !isOnAdPage}
       playbackAllowed={
          isPlaybackActive &&
          index === activeProductIndex &&
          !isOnAdPage
       }
       isSearchSheetVisible={isSearchSheetVisible}
       searchSheetMetrics={searchSheetMetrics}
       shouldPreloadVideo={Math.abs(index - activeProductIndex) <= 1}
       bottomChromeOffset={DETAIL_SEARCH_CHROME_OFFSET}
       pageHeight={screenHeight}
       mediaWidth={screenWidth}
       topInset={insets.top}
       bottomInset={insets.bottom}
       onBack={handleBack}
       showDetailAd
       onCloseSearchSheet={closeSearchSheet}
       onPlaybackStateChange={handlePlaybackStateChange}
       onSummarySheetStateChange={handleSummarySheetStateChange}
       s={s}
     />
   ),
   [
     activeProductIndex,
     closeSearchSheet,
     handleSummarySheetStateChange,
     handlePlaybackStateChange,
     handleBack,
     insets.bottom,
     insets.top,
      isOnAdPage,
     isPlaybackActive,
     isSearchSheetVisible,
     navigation,
     s,
     searchSheetMetrics,
     screenHeight,
     screenWidth,
   ],
 );

  return (
    <View style={s.safeArea}>
      <StatusBar barStyle="light-content" />
      <PagerView
        key={detailPagerKey}
        ref={verticalPagerRef}
        initialPage={activeDisplayIndex}
        offscreenPageLimit={1}
        onPageSelected={(event) => {
          const nextDisplay = event.nativeEvent.position;
          setActivePagerIndex(nextDisplay);
          const entry = feedItems[nextDisplay];
          if (
            entry &&
            (!isReelsContentItem(entry) || entry.content.id !== groupBuy.id)
          ) {
            hasDepartedRouteRef.current = true;
          }
          if (entry && !isReelsContentItem(entry)) {
            setIsOnAdPage(true);
            return;
          }
          setIsOnAdPage(false);
          const nextIndex = entry ? reelItems.indexOf(entry.content) : -1;
          if (
            nextIndex !== activeProductIndex &&
            nextIndex >= 0 &&
            nextIndex < reelItems.length
          ) {
            setActiveProductId(reelItems[nextIndex].id);
          }
        }}
        orientation="vertical"
        overdrag
        scrollEnabled={
          screenHeight > 0 &&
          feedItems.length > 1 &&
          !summarySheetGate.isOpen &&
          !isSearchSheetVisible
        }
        style={s.verticalPager}
      >
        {feedItems.map((entry, index) => {
          if (!isReelsContentItem(entry)) {
            return (
              <View
                key={entry.key}
                collapsable={false}
                style={[s.verticalPagerPage, { height: screenHeight }]}
              >
                <View style={s.reelAdPage}>
                  <View
                    accessibilityLiveRegion="polite"
                    style={s.reelAdLoading}
                  >
                    <SText variant="caption" style={s.reelAdLoadingLabel}>광고</SText>
                    <SText variant="body" style={s.reelAdLoadingText}>
                      광고를 불러오는 중이에요
                    </SText>
                  </View>
                  <NativeAdCard
                    loadEnabled={Math.abs(index - activePagerIndex) <= 1}
                    onLoadStateChange={handleDetailAdLoadStateChange}
                    placement="detail"
                    testID={`detail-native-ad-${entry.sequence}`}
                    variant="reel"
                    visible={index === activePagerIndex}
                  />
                </View>
              </View>
            );
          }
         const item = entry.content;
         const organicIndex = reelItems.indexOf(item);
          return (
         <View
           key={entry.key}
           collapsable={false}
           style={[
             s.verticalPagerPage,
             {
               height: screenHeight,
             },
           ]}
         >
           {renderReelItem({ item, index: organicIndex })}
         </View>
          );
        })}
      </PagerView>
      {!summarySheetGate.isOpen && !isSearchSheetVisible ? (
        <DetailSearchDock
          bottomInset={insets.bottom}
          onPress={openSearchSheet}
          s={s}
        />
      ) : null}
      {isSearchSheetVisible ? (
        <DetailSearchSheet
          bottomInset={insets.bottom}
          data={filteredSearchItems}
          keyboardHeight={keyboardHeight}
          maxHeight={searchSheetMaxHeight}
          onClose={closeSearchSheet}
          onSheetLayout={handleSearchSheetLayout}
          onSelect={handleSelectSearchResult}
          query={searchQuery}
          sheetTranslate={searchSheetTranslate}
          setQuery={setSearchQuery}
          s={s}
        />
      ) : null}
    </View>
  );
}

export function makeStyles(
  colors: ColorPalette,
  shadows: Record<"sm" | "md" | "lg", any>,
) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#05070A" },
    verticalPager: {
      backgroundColor: "#05070A",
      flex: 1,
      overflow: "hidden",
    },
    verticalPagerPage: {
      backgroundColor: "#05070A",
      width: "100%",
    },
    reelAdPage: {
      backgroundColor: "#05070A",
      flex: 1,
    },
    reelAdLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    reelAdLoadingLabel: {
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 4,
      color: "rgba(255,255,255,0.72)",
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 12,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    reelAdLoadingText: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 14,
      fontWeight: "500",
    },
    detailSearchDock: {
      bottom: 0,
      left: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      position: "absolute",
      right: 0,
      zIndex: 20,
    },
    detailSearchButton: {
      alignItems: "center",
      backgroundColor: "rgba(24,27,33,0.92)",
      borderColor: "rgba(255,255,255,0.10)",
      borderRadius: 28,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      height: 54,
      paddingHorizontal: spacing.lg,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
      ...shadows.md,
    },
    detailSearchButtonText: {
      color: "rgba(255,255,255,0.72)",
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
    },
    detailSearchOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      zIndex: 40,
    },
    detailSearchBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    detailSearchKeyboard: {
      justifyContent: "flex-end",
    },
    detailSearchSheet: {
      backgroundColor: "#1F2229",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: "70%",
      minHeight: 360,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    detailSearchHandle: {
      alignSelf: "center",
      backgroundColor: "rgba(255,255,255,0.42)",
      borderRadius: 999,
      height: 4,
      marginBottom: spacing.lg,
      width: 52,
    },
    detailSearchHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: spacing.md,
    },
    detailSearchTitle: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "900",
    },
    detailSearchInputWrap: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
      borderColor: "rgba(255,255,255,0.12)",
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      height: 48,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    detailSearchInput: {
      color: "#FFFFFF",
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      padding: 0,
    },
    detailSearchList: {
      flexGrow: 0,
    },
    detailSearchResult: {
      alignItems: "center",
      borderBottomColor: "rgba(255,255,255,0.08)",
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 70,
      paddingVertical: spacing.sm,
    },
    detailSearchThumb: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 12,
      height: 52,
      width: 52,
    },
    detailSearchThumbFallback: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 12,
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    detailSearchResultBody: {
      flex: 1,
      minWidth: 0,
    },
    detailSearchResultTitle: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 3,
    },
    detailSearchResultMeta: {
      color: "rgba(255,255,255,0.56)",
      fontSize: 12,
      fontWeight: "700",
    },
    detailSearchEmpty: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 150,
    },
    detailSearchEmptyText: {
      color: "rgba(255,255,255,0.58)",
      fontWeight: "700",
    },
    reelPage: {
      backgroundColor: "#05070A",
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    mediaStage: {
      backgroundColor: "#05070A",
      overflow: "hidden",
      position: "absolute",
    },
    mediaStageContent: {
      backgroundColor: "#05070A",
      left: 0,
      position: "absolute",
      top: 0,
    },
    mediaStageWithSheet: {
      borderRadius: 22,
      left: MEDIA_STAGE_SIDE_INSET,
      overflow: "hidden",
      right: MEDIA_STAGE_SIDE_INSET,
    },
    mediaScroller: { flex: 1 },
    mediaViewport: {
      flex: 1,
      overflow: "hidden",
    },
    mediaPane: {
      backgroundColor: "#05070A",
      height: "100%",
    },
    mediaFill: {
      height: "100%",
      width: "100%",
    },
    videoSlide: {
      height: "100%",
      position: "relative",
      width: "100%",
    },
    videoPoster: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    videoTapLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    videoStatusOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 4,
    },
    videoErrorOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      backgroundColor: "rgba(5,7,10,0.68)",
      justifyContent: "center",
      padding: spacing.lg,
      zIndex: 5,
    },
    videoStatusText: {
      color: "rgba(255,255,255,0.88)",
      marginTop: spacing.sm,
      textAlign: "center",
    },
    videoRetryButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
      borderColor: "rgba(255,255,255,0.28)",
      borderRadius: borderRadius.md,
      borderWidth: 1,
      marginTop: spacing.md,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    videoRetryLabel: {
      color: "#FFFFFF",
      fontWeight: "800",
    },
    videoControlsOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3,
    },
    muteOverlayButton: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      marginBottom: spacing.sm,
      width: 40,
    },
    playOverlayButton: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.46)",
      borderColor: "rgba(255,255,255,0.12)",
      borderRadius: 38,
      borderWidth: 1,
      height: 76,
      justifyContent: "center",
      width: 76,
    },
    emptyMedia: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
    },
    emptyMediaText: { color: "rgba(255,255,255,0.72)" },
    videoPlaceholder: {
      alignItems: "center",
      backgroundColor: "#05070A",
      height: "100%",
      justifyContent: "center",
      width: "100%",
    },
    videoPlaceholderText: {
      color: "rgba(255,255,255,0.78)",
      fontSize: 14,
      fontWeight: "800",
    },
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      left: 0,
      paddingHorizontal: spacing.lg,
      position: "absolute",
      right: 0,
      top: 0,
    },
    topIconButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    reelsTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xl,
    },
    reelsTitle: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "800",
      textShadowColor: "rgba(0,0,0,0.36)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    mediaDots: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      left: spacing.xl,
      position: "absolute",
      right: spacing.xl,
    },
    mediaDot: {
      backgroundColor: "rgba(255,255,255,0.42)",
      borderRadius: 2,
      height: 3,
      width: 28,
    },
    mediaDotActive: { backgroundColor: "#FFFFFF" },
    mediaDotFaded: { opacity: 0.46, width: 16 },
    rightRail: {
      alignItems: "center",
      gap: spacing.sm,
      position: "absolute",
      right: spacing.md,
      width: 58,
    },
    railButton: {
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
      width: 52,
    },
    purchaseRailButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderColor: "rgba(255,255,255,0.48)",
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 54,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      width: 58,
      ...shadows.sm,
    },
    railIcon: {
      color: "#FFFFFF",
      fontSize: 34,
      fontWeight: "500",
      lineHeight: 38,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.44)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    railIconBox: {
      alignItems: "center",
      height: 34,
      justifyContent: "center",
      width: 52,
    },
    purchaseGlyph: {
      height: 22,
      position: "relative",
      width: 22,
    },
    purchaseLinkRingA: {
      borderColor: "#FFFFFF",
      borderRadius: 6,
      borderWidth: 2,
      height: 9,
      left: 2,
      position: "absolute",
      top: 8,
      transform: [{ rotate: "-32deg" }],
      width: 13,
    },
    purchaseLinkRingB: {
      borderColor: colors.accent,
      borderRadius: 6,
      borderWidth: 2,
      height: 9,
      position: "absolute",
      right: 2,
      top: 5,
      transform: [{ rotate: "-32deg" }],
      width: 13,
    },
    purchaseLinkBridge: {
      backgroundColor: "#FFFFFF",
      borderRadius: 999,
      height: 2,
      left: 8,
      position: "absolute",
      top: 11,
      transform: [{ rotate: "-32deg" }],
      width: 7,
    },
    purchaseRailLabel: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
      lineHeight: 12,
      marginTop: 1,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.18)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    railLabel: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.44)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    bottomInfo: {
      bottom: 0,
      left: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      position: "absolute",
      right: 76,
    },
    bottomInfoScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
      borderTopRightRadius: 18,
    },
    sellerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderColor: "rgba(255,255,255,0.92)",
      borderRadius: borderRadius.full,
      borderWidth: 2,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "900",
    },
    sellerName: {
      color: "#FFFFFF",
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "800",
      textShadowColor: "rgba(0,0,0,0.42)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    followTargetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
    followTargetChip: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.34)",
      borderColor: "rgba(255, 255, 255, 0.34)",
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    followTargetChipActive: {
      backgroundColor: "rgba(255, 255, 255, 0.92)",
      borderColor: colors.accent,
    },
    followTargetText: { color: "#FFFFFF", fontWeight: "900" },
    followTargetTextActive: { color: colors.accent },
    productName: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 20,
      marginBottom: 4,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    productPrice: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
      marginBottom: spacing.xs,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryPreview: {
      alignSelf: "stretch",
      marginBottom: spacing.xs,
    },
    summary: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryMore: {
      alignSelf: "flex-start",
      color: "rgba(255,255,255,0.74)",
      fontSize: 13,
      fontWeight: "800",
      marginTop: 0,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: 0,
    },
    metaPill: {
      backgroundColor: "rgba(255,255,255,0.18)",
      borderColor: "rgba(255,255,255,0.22)",
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    metaPillUrgent: {
      backgroundColor: "rgba(255,59,48,0.72)",
      borderColor: "rgba(255,255,255,0.24)",
    },
    metaPillExpired: {
      backgroundColor: "rgba(142,142,147,0.64)",
      borderColor: "rgba(255,255,255,0.18)",
    },
    metaPillText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },
    summaryOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      zIndex: 30,
    },
    summaryBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    summaryDragArea: {
      flexShrink: 0,
    },
    summarySheet: {
      backgroundColor: "#111417",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    summaryHandle: {
      alignItems: "center",
      // Generous touch target so the sheet is easy to grab and drag down.
      height: 28,
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    summaryHandleBar: {
      alignSelf: "center",
      backgroundColor: "rgba(255,255,255,0.62)",
      borderRadius: 2,
      height: 5,
      width: 58,
    },
    summarySheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    summarySheetSeller: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.md,
      minWidth: 0,
    },
    summarySheetAvatar: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderColor: "rgba(255,255,255,0.92)",
      borderRadius: borderRadius.full,
      borderWidth: 2,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    summarySheetTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    summarySheetSellerName: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    summarySheetProductName: {
      color: "rgba(255,255,255,0.66)",
      fontSize: 13,
      fontWeight: "500",
      marginTop: 2,
    },
    summarySheetProductPrice: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    summarySheetBuyButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "#FFFFFF",
      borderRadius: borderRadius.full,
      height: 32,
      justifyContent: "center",
      marginBottom: spacing.lg,
      minWidth: 88,
      paddingHorizontal: spacing.md,
    },
    summarySheetBuyButtonExpired: {
      backgroundColor: "rgba(255,255,255,0.36)",
    },
    summarySheetBuyButtonText: {
      color: "#111318",
      fontSize: 12,
      fontWeight: "700",
    },
    summaryScroll: {
      flexGrow: 0,
    },
    summarySheetText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "500",
      lineHeight: 22,
      paddingBottom: spacing.xl,
    },
    summarySheetAd: {
      paddingBottom: spacing.lg,
    },
    pressed: { opacity: 0.72 },
  });
}
