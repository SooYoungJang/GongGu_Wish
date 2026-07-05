import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Alert,
  BackHandler,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { VideoView, useVideoPlayer } from 'expo-video';
import PagerView from 'react-native-pager-view';
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import { fetchGroupBuys } from '../api';
import { Ionicons } from '@expo/vector-icons';
import { useBookmarks, useNotifications, useRecentViews } from '../hooks/useLocalDeals';
import { SText } from '../components/ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { DetailScreenProps, GroupBuy } from '../types';
import { formatEndDate, getDaysRemaining } from '../utils';

const MAX_VISIBLE_DOTS = 5;
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.m3u8', '.mkv', '.avi', '.ts'];
const SUMMARY_EDGE_DISMISS_DISTANCE = 56;
const SUMMARY_SCROLL_TOP_EPSILON = 2;
const DETAIL_SEARCH_CHROME_OFFSET = 72;

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
  const typedMediaItems = groupBuy.mediaItems
    ?.filter((item) => item?.url)
    .map((item) => ({
      url: item.url,
      isVideo: item.mediaType === 'VIDEO' || isVideoUrl(item.url),
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
  const urls = groupBuy.videoUrl && !rawUrls.includes(groupBuy.videoUrl)
    ? [groupBuy.videoUrl, ...rawUrls]
    : rawUrls;

  return urls.map((url) => ({
    url,
    isVideo: url === groupBuy.videoUrl || isVideoUrl(url),
    thumbnailUrl: url === groupBuy.videoUrl ? groupBuy.thumbnailUrl : null,
  }));
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
      items.push(current);
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
  return item.thumbnailUrl
    ?? item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl
    ?? item.mediaItems?.find((media) => !media.mediaType || media.mediaType === 'IMAGE')?.url
    ?? item.mediaUrls?.[0]
    ?? null;
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
    .join(' ')
    .toLowerCase();
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
  s: ReturnType<typeof makeStyles>;
};

const VideoSlide = memo(function VideoSlide({ url, isActive, thumbnailUrl, s }: VideoSlideProps) {
  const [shouldPlay, setShouldPlay] = useState(true);
  const [isMuted, setMuted] = useState(false);
  const [areControlsVisible, setControlsVisible] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = useMemo(
    () => ({
      uri: url,
      contentType: 'auto' as const,
    }),
    [url],
  );

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 1;
    p.audioMixingMode = 'doNotMix';
    p.allowsExternalPlayback = false;
  });

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
    player.muted = isMuted;
    player.volume = 1;
    player.audioMixingMode = 'doNotMix';

    if (isActive && shouldPlay) {
      player.play();
    } else {
      player.pause();
      if (!isActive) player.currentTime = 0;
    }
  }, [isActive, isMuted, player, shouldPlay]);

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
      player.muted = isMuted;
      player.volume = 1;
      player.audioMixingMode = 'doNotMix';

      if (next && isActive) {
        player.play();
      } else {
        player.pause();
      }
      return next;
    });
  }, [isActive, isMuted, player, showControlsTemporarily]);

  const toggleMuted = useCallback(() => {
    showControlsTemporarily();
    setMuted((current) => {
      const next = !current;
      player.muted = next;
      player.volume = 1;
      player.audioMixingMode = 'doNotMix';
      return next;
    });
  }, [player, showControlsTemporarily]);

  return (
    <View style={s.videoSlide}>
      <VideoView
        player={player}
        style={s.mediaFill}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
        onFirstFrameRender={() => {
          setHasFirstFrame(true);
          player.muted = isMuted;
          player.volume = 1;
          player.audioMixingMode = 'doNotMix';
          if (isActive && shouldPlay) player.play();
        }}
      />
      {thumbnailUrl && !hasFirstFrame ? (
        <Image source={{ uri: thumbnailUrl }} style={s.videoPoster} resizeMode="contain" />
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
            accessibilityLabel={isMuted ? '음소거 해제' : '음소거'}
            accessibilityRole="button"
            onPress={toggleMuted}
            style={({ pressed }) => [s.muteOverlayButton, pressed && s.pressed]}
          >
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityLabel={shouldPlay ? '동영상 일시정지' : '동영상 재생'}
            accessibilityRole="button"
            onPress={togglePlayback}
            style={({ pressed }) => [s.playOverlayButton, pressed && s.pressed]}
          >
            <Ionicons name={shouldPlay ? 'pause' : 'play'} size={28} color="#FFFFFF" />
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
};

function ReelAction({ icon, label, onPress, s }: ReelActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.railButton, pressed && s.pressed]}
    >
      <View style={s.railIconBox}>{icon}</View>
      <SText variant="caption" style={s.railLabel}>{label}</SText>
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

function ReelPurchaseAction({ onPress, s }: Pick<ReelActionProps, 'onPress' | 's'>) {
  return (
    <Pressable
      accessibilityLabel="구매 링크"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.purchaseRailButton, pressed && s.pressed]}
    >
      <PurchaseGlyph s={s} />
      <SText variant="caption" style={s.purchaseRailLabel}>구매 링크</SText>
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
    <View pointerEvents="box-none" style={[s.detailSearchDock, { paddingBottom: bottomInset + spacing.sm }]}>
      <Pressable
        accessibilityLabel="상품 검색"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [s.detailSearchButton, pressed && s.pressed]}
      >
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.82)" />
        <SText variant="body" style={s.detailSearchButtonText}>상품을 검색해보세요</SText>
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
  onKeyboardHeightChange(height: number): void;
  // eslint-disable-next-line no-unused-vars
  onSheetDragEnd(dy: number, vy: number): void;
  // eslint-disable-next-line no-unused-vars
  onSheetDragMove: (dy: number) => void;
  onSheetDragStart: () => void;
  // eslint-disable-next-line no-unused-vars
  onSheetLayout: (event: LayoutChangeEvent) => void;
  // eslint-disable-next-line no-unused-vars
  onSelect(item: GroupBuy): void;
  query: string;
  sheetTranslate: Animated.Value;
  // eslint-disable-next-line no-unused-vars
  setQuery(query: string): void;
  s: ReturnType<typeof makeStyles>;
};

function DetailSearchSheet({
  bottomInset,
  data,
  maxHeight,
  onClose,
  onKeyboardHeightChange,
  onSelect,
  onSheetDragEnd,
  onSheetDragMove,
  onSheetDragStart,
  onSheetLayout,
  query,
  sheetTranslate,
  setQuery,
  s,
}: DetailSearchSheetProps) {
  const inputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const nextHeight = event.endCoordinates.height;
      setKeyboardHeight(nextHeight);
      onKeyboardHeightChange(nextHeight);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      onKeyboardHeightChange(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [onKeyboardHeightChange]);

  const dismissPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => (
        gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      ),
      onMoveShouldSetPanResponderCapture: (_event, gestureState) => (
        gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      ),
      onPanResponderGrant: onSheetDragStart,
      onPanResponderMove: (_event, gestureState) => {
        onSheetDragMove(gestureState.dy);
      },
      onPanResponderRelease: (_event, gestureState) => {
        onSheetDragEnd(gestureState.dy, gestureState.vy);
      },
    }),
    [onSheetDragEnd, onSheetDragMove, onSheetDragStart],
  );

  return (
    <View style={s.detailSearchOverlay} pointerEvents="box-none">
      <Pressable
        accessibilityLabel="상품 검색 닫기"
        accessibilityRole="button"
        onPress={onClose}
        style={s.detailSearchBackdrop}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        pointerEvents="box-none"
        style={[s.detailSearchKeyboard, { paddingBottom: keyboardHeight }]}
      >
        <Animated.View
          onLayout={onSheetLayout}
          style={[
            s.detailSearchSheet,
            {
              maxHeight,
              paddingBottom: bottomInset + spacing.md,
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
          {...dismissPanResponder.panHandlers}
        >
          <View style={s.detailSearchHandle} />
          <View style={s.detailSearchHeader}>
            <SText variant="cardTitle" style={s.detailSearchTitle}>상품 검색</SText>
          </View>
          <View style={s.detailSearchInputWrap}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.58)" />
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
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={(
              <View style={s.detailSearchEmpty}>
                <SText variant="body" style={s.detailSearchEmptyText}>검색 결과가 없어요</SText>
              </View>
            )}
            renderItem={({ item }) => {
              const thumb = getGroupBuyThumb(item);
              const sellerName = item.rawPost.influencer.instagramUsername.replace(/^@/, '');
              return (
                <Pressable
                  accessibilityLabel={`${item.productName ?? '상품'} 보기`}
                  accessibilityRole="button"
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [s.detailSearchResult, pressed && s.pressed]}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={s.detailSearchThumb} resizeMode="cover" />
                  ) : (
                    <View style={s.detailSearchThumbFallback}>
                      <Ionicons name="cube-outline" size={20} color="rgba(255,255,255,0.7)" />
                    </View>
                  )}
                  <View style={s.detailSearchResultBody}>
                    <SText variant="cardTitle" style={s.detailSearchResultTitle} numberOfLines={1}>
                      {item.productName ?? '제품명 미확인'}
                    </SText>
                    <SText variant="caption" style={s.detailSearchResultMeta} numberOfLines={1}>
                      {item.brandName ?? `@${sellerName}`} · {formatEndDate(item.endDate)}
                    </SText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.42)" />
                </Pressable>
              );
            }}
            style={s.detailSearchList}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

export type ProductReelPageProps = {
  groupBuy: GroupBuy;
  isActive: boolean;
  isSearchSheetVisible?: boolean;
  searchSheetMetrics?: {
    height: number;
    translateY: Animated.Value;
  } | null;
  shouldPreloadVideo?: boolean;
  bottomChromeOffset?: number;
  pageHeight: number;
  mediaWidth: number;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  showBackButton?: boolean;
  onCloseSearchSheet?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSummarySheetStateChange(isOpen: boolean, canSwipeReel: boolean): void;
  s: ReturnType<typeof makeStyles>;
};

export function ProductReelPage({
  groupBuy,
  isActive,
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
  onCloseSearchSheet,
  onSummarySheetStateChange,
  s,
}: ProductReelPageProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isSummaryExpanded, setSummaryExpanded] = useState(false);
  const { colors } = useTheme();
  const [summaryScrollContentHeight, setSummaryScrollContentHeight] = useState(0);
  const [summaryScrollViewportHeight, setSummaryScrollViewportHeight] = useState(0);
  const [isSummaryScrollAtTop, setSummaryScrollAtTop] = useState(true);
  const [isSummaryScrollAtBottom, setSummaryScrollAtBottom] = useState(false);
  const summaryScrollOffsetRef = useRef(0);
  const summaryScrollContentHeightRef = useRef(0);
  const summaryScrollViewportHeightRef = useRef(0);
  const summaryScrollAtTopRef = useRef(true);
  const summaryScrollAtBottomRef = useRef(false);
  const summaryScrollGestureStartedAtTopRef = useRef(true);
  const [isSummaryVisible, setSummaryVisible] = useState(false);
  const [summarySheetMeasuredHeight, setSummarySheetMeasuredHeight] = useState(0);
  const mediaItems = useMemo(() => getDisplayMedia(groupBuy), [groupBuy]);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { isNotifying, toggleNotification } = useNotifications();
  const deadlineLabel = formatEndDate(groupBuy.endDate);
  const daysRemaining = getDaysRemaining(groupBuy.endDate);
  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;
  const sellerName = groupBuy.rawPost.influencer.instagramUsername.replace(/^@/, '');
  const summary = groupBuy.summary ?? groupBuy.discountInfo ?? '';
  const summarySheetMaxHeight = Math.max(
    280,
    Math.min(pageHeight - topInset - spacing.xl, pageHeight * 0.62),
  );
  const summarySheetTranslate = useRef(new Animated.Value(summarySheetMaxHeight)).current;
  const sheetDragStartY = useRef(0);
  const summarySheetHeightForMedia = Math.max(
    1,
    Math.min(summarySheetMeasuredHeight || summarySheetMaxHeight, summarySheetMaxHeight),
  );
  const activeSheetTranslate = isSearchSheetVisible && searchSheetMetrics
    ? searchSheetMetrics.translateY
    : summarySheetTranslate;
  const activeSheetHeightForMedia = isSearchSheetVisible && searchSheetMetrics
    ? Math.max(1, searchSheetMetrics.height)
    : summarySheetHeightForMedia;
  const mediaStageOpenTop = topInset + 64;
  const minMediaStageHeight = Math.min(
    Math.max(MEDIA_STAGE_MIN_HEIGHT, pageHeight * MEDIA_STAGE_MIN_HEIGHT_RATIO),
    Math.max(1, pageHeight - mediaStageOpenTop - MEDIA_STAGE_MIN_SHEET_SPACE),
  );
  const cappedSheetHeightForMedia = Math.min(
    activeSheetHeightForMedia,
    Math.max(1, pageHeight - mediaStageOpenTop - minMediaStageHeight),
  );
  // 0 = sheet fully open, 1 = sheet fully closed. Drives the media stage size
  // so it smoothly grows/shrinks in sync with the sheet position.
  const sheetProgress = useMemo(
    () => activeSheetTranslate.interpolate({
      inputRange: [0, cappedSheetHeightForMedia],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [activeSheetTranslate, cappedSheetHeightForMedia],
  );
  // Media stage interpolations: 0 (open) -> collapsed card, 1 (closed) -> full screen.
  const mediaStageOpenWidth = mediaWidth - MEDIA_STAGE_SIDE_INSET * 2;
  const mediaStageOpenHeight = Math.max(
    0,
    pageHeight - mediaStageOpenTop - cappedSheetHeightForMedia,
  );
  const animatedMediaStageWidth = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [mediaStageOpenWidth, mediaWidth],
      extrapolate: 'clamp',
    }),
    [mediaStageOpenWidth, mediaWidth, sheetProgress],
  );
  const animatedMediaStageHeight = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [mediaStageOpenHeight, pageHeight],
      extrapolate: 'clamp',
    }),
    [mediaStageOpenHeight, pageHeight, sheetProgress],
  );
  const animatedMediaStageTop = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [mediaStageOpenTop, 0],
      extrapolate: 'clamp',
    }),
    [mediaStageOpenTop, sheetProgress],
  );
  const animatedMediaStageBottom = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [cappedSheetHeightForMedia, 0],
      extrapolate: 'clamp',
    }),
    [cappedSheetHeightForMedia, sheetProgress],
  );
  const animatedMediaStageRadius = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [22, 0],
      extrapolate: 'clamp',
    }),
    [sheetProgress],
  );
  const animatedMediaStageLeft = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [MEDIA_STAGE_SIDE_INSET, 0],
      extrapolate: 'clamp',
    }),
    [sheetProgress],
  );
  const animatedMediaStageRight = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [MEDIA_STAGE_SIDE_INSET, 0],
      extrapolate: 'clamp',
    }),
    [sheetProgress],
  );
  // Reel chrome (right rail, bottom info, dots) fades with the sheet: visible
  // when closed, hidden when the sheet is open.
  const animatedReelChromeOpacity = useMemo(
    () => sheetProgress.interpolate({
      inputRange: [0, 0.35],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [sheetProgress],
  );
  const isMediaStageCompact = isSummaryExpanded || isSearchSheetVisible;
  const mediaStageWidth = animatedMediaStageWidth;
  const mediaStageHeight = animatedMediaStageHeight;
  const mediaStageTop = animatedMediaStageTop;
  const mediaStageBottom = animatedMediaStageBottom;
  const mediaStageRadius = animatedMediaStageRadius;
  const mediaStageLeft = animatedMediaStageLeft;
  const mediaStageRight = animatedMediaStageRight;
  const reelChromeOpacity = isSearchSheetVisible ? 0 : animatedReelChromeOpacity;

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
    summarySheetTranslate.stopAnimation();
    summarySheetTranslate.setValue(summarySheetMaxHeight);
  }, [summarySheetMaxHeight, summarySheetTranslate]);

  const snapSummarySheetOpen = useCallback(() => {
    Animated.spring(summarySheetTranslate, {
      toValue: 0,
      useNativeDriver: false,
      friction: 9,
      tension: 50,
    }).start();
  }, [summarySheetTranslate]);

  const setSummaryOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setSummaryExpanded(true);
        setSummaryVisible(true);
        snapSummarySheetOpen();
      } else {
        Animated.timing(summarySheetTranslate, {
          toValue: summarySheetMaxHeight,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          resetSummarySheetState();
        });
      }
      onSummarySheetStateChange(isOpen, false);
    },
    [onSummarySheetStateChange, resetSummarySheetState, snapSummarySheetOpen, summarySheetMaxHeight, summarySheetTranslate],
  );

  const startSummarySheetDrag = useCallback(() => {
    summarySheetTranslate.stopAnimation((value) => {
      sheetDragStartY.current = typeof value === 'number' ? value : 0;
    });
  }, [summarySheetTranslate]);

  const moveSummarySheetDrag = useCallback(
    (dy: number) => {
      const next = sheetDragStartY.current + Math.max(0, dy);
      summarySheetTranslate.setValue(Math.min(next, summarySheetMaxHeight));
    },
    [summarySheetMaxHeight, summarySheetTranslate],
  );

  const finishSummarySheetDrag = useCallback(
    (dy: number, vy: number) => {
      const draggedDown = dy > 12;
      const pastThreshold = dy > Math.max(72, summarySheetMaxHeight * 0.28);
      const flickedDown = vy > 0.65;
      if (draggedDown && (pastThreshold || flickedDown)) {
        setSummaryOpen(false);
      } else {
        snapSummarySheetOpen();
      }
    },
    [setSummaryOpen, snapSummarySheetOpen, summarySheetMaxHeight],
  );

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isSummaryVisible,
        onMoveShouldSetPanResponder: (_e, gestureState) => {
          if (!isSummaryVisible) return false;
          return Math.abs(gestureState.dy) > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: startSummarySheetDrag,
        onPanResponderMove: (_e, gestureState) => moveSummarySheetDrag(gestureState.dy),
        onPanResponderRelease: (_e, gestureState) => finishSummarySheetDrag(gestureState.dy, gestureState.vy),
        onPanResponderTerminate: snapSummarySheetOpen,
      }),
    [finishSummarySheetDrag, isSummaryVisible, moveSummarySheetDrag, snapSummarySheetOpen, startSummarySheetDrag],
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

  // 안드로이드 물리 뒤로가기: 바텀시트가 열려 있으면 시트를 닫고, 아니면 기본 동작.
  useEffect(() => {
    if (!isActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearchSheetVisible) {
        onCloseSearchSheet?.();
        return true;
      }
      if (isSummaryVisible) {
        setSummaryOpen(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [isActive, isSearchSheetVisible, isSummaryVisible, onCloseSearchSheet, setSummaryOpen]);

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

  const summaryContentFitsViewport = summaryScrollContentHeight > 0
    && summaryScrollContentHeight <= summaryScrollViewportHeight + 2;

  const canPullSummarySheetFromScroll = isSummaryScrollAtTop || summaryContentFitsViewport;

  const finishSummarySheetScrollPull = useCallback(
    (translationY: number, velocityY: number) => {
      const draggedDown = translationY > 12;
      const pastThreshold = translationY > SUMMARY_EDGE_DISMISS_DISTANCE;
      const flickedDown = velocityY > 650;
      if (draggedDown && (pastThreshold || flickedDown)) {
        setSummaryOpen(false);
      } else {
        snapSummarySheetOpen();
      }
    },
    [setSummaryOpen, snapSummarySheetOpen],
  );

  const summaryScrollPullGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSummaryVisible && canPullSummarySheetFromScroll)
        .activeOffsetY(4)
        .failOffsetX([-24, 24])
        .runOnJS(true)
        .onBegin(() => {
          startSummarySheetDrag();
        })
        .onUpdate((event) => {
          const canPullFromTop = summaryScrollAtTopRef.current || summaryContentFitsViewport;
          if (canPullFromTop && event.translationY > 0) {
            moveSummarySheetDrag(event.translationY);
          }
        })
        .onEnd((event) => {
          const canPullFromTop = summaryScrollAtTopRef.current || summaryContentFitsViewport;
          if (canPullFromTop && event.translationY > 0) {
            finishSummarySheetScrollPull(event.translationY, event.velocityY);
          }
        }),
    [
      canPullSummarySheetFromScroll,
      finishSummarySheetScrollPull,
      isSummaryVisible,
      moveSummarySheetDrag,
      startSummarySheetDrag,
      summaryContentFitsViewport,
    ],
  );

  const handleSummaryScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const nextOffset = event.nativeEvent.contentOffset.y;
      const isPullingPastTop = nextOffset < 0
        && (summaryScrollGestureStartedAtTopRef.current || summaryContentFitsViewport);
      const canSwipeReel = canSwipeReelFromSummaryOffset(nextOffset);
      summaryScrollOffsetRef.current = nextOffset;
      summaryScrollAtTopRef.current = nextOffset <= SUMMARY_SCROLL_TOP_EPSILON;
      summaryScrollAtBottomRef.current = canSwipeReel;
      if (isPullingPastTop) {
        summarySheetTranslate.setValue(Math.min(-nextOffset, summarySheetMaxHeight));
      }
      setSummaryScrollAtTop(summaryScrollAtTopRef.current);
      setSummaryScrollAtBottom(canSwipeReel);
      onSummarySheetStateChange(true, canSwipeReel);
    },
    [
      canSwipeReelFromSummaryOffset,
      isSummaryExpanded,
      onSummarySheetStateChange,
      summaryContentFitsViewport,
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
        const canSwipeReel = canSwipeReelFromSummaryOffset(summaryScrollOffsetRef.current, nextHeight);
        summaryScrollAtBottomRef.current = canSwipeReel;
        setSummaryScrollAtBottom(canSwipeReel);
        onSummarySheetStateChange(true, canSwipeReel);
      }
    },
    [canSwipeReelFromSummaryOffset, isSummaryExpanded, onSummarySheetStateChange],
  );

  const handleSummarySheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.min(event.nativeEvent.layout.height, summarySheetMaxHeight);
      setSummarySheetMeasuredHeight((current) => (
        Math.abs(current - nextHeight) < 1 ? current : nextHeight
      ));
    },
    [summarySheetMaxHeight],
  );

  const handleSummaryContentSizeChange = useCallback(
    (_width: number, height: number) => {
      summaryScrollContentHeightRef.current = height;
      setSummaryScrollContentHeight(height);
      if (isSummaryExpanded) {
        const canSwipeReel = canSwipeReelFromSummaryOffset(summaryScrollOffsetRef.current, undefined, height);
        summaryScrollAtBottomRef.current = canSwipeReel;
        setSummaryScrollAtBottom(canSwipeReel);
        onSummarySheetStateChange(true, canSwipeReel);
      }
    },
    [canSwipeReelFromSummaryOffset, isSummaryExpanded, onSummarySheetStateChange],
  );

  // Keep edge bounces enabled so the touch can hand off at both scroll ends.
  const summaryBounces = isSummaryExpanded
    && (isSummaryScrollAtTop || isSummaryScrollAtBottom || summaryContentFitsViewport);

  const sheetBodyPanResponder = useMemo(
    () => {
      const shouldDragSheet = (_e: unknown, gestureState: { dx: number; dy: number }) => {
        if (!isSummaryVisible) return false;
        if (Math.abs(gestureState.dy) <= 4) return false;
        if (Math.abs(gestureState.dy) <= Math.abs(gestureState.dx)) return false;
        return gestureState.dy > 4 && (summaryScrollAtTopRef.current || summaryContentFitsViewport);
      };

      return PanResponder.create({
        onMoveShouldSetPanResponder: shouldDragSheet,
        onMoveShouldSetPanResponderCapture: shouldDragSheet,
        onPanResponderGrant: startSummarySheetDrag,
        onPanResponderMove: (_e, gestureState) => moveSummarySheetDrag(gestureState.dy),
        onPanResponderRelease: (_e, gestureState) => finishSummarySheetDrag(gestureState.dy, gestureState.vy),
        onPanResponderTerminate: snapSummarySheetOpen,
      });
    },
    [
      finishSummarySheetDrag,
      isSummaryScrollAtTop,
      isSummaryVisible,
      moveSummarySheetDrag,
      snapSummarySheetOpen,
      startSummarySheetDrag,
      summaryContentFitsViewport,
    ],
  );

  const handleSummaryScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const { y } = event.nativeEvent.contentOffset;
      const draggedPastTop = y <= -SUMMARY_EDGE_DISMISS_DISTANCE
        && (summaryScrollGestureStartedAtTopRef.current || summaryContentFitsViewport);
      if (draggedPastTop) {
        setSummaryOpen(false);
      }
    },
    [
      isSummaryExpanded,
      setSummaryOpen,
      summaryContentFitsViewport,
    ],
  );

  const handleShare = async () => {
    const productName = groupBuy.productName ?? '공동구매';
    try {
      await Share.share({
        message: `${productName} (@${sellerName})\n${groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl}`,
      });
    } catch {
      Alert.alert('오류', '공유에 실패했습니다.');
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
        : `https://${trimmedUrl.replace(/^\/+/, '')}`
      : null;

    if (!openUrl) {
      Alert.alert('링크 없음', '열 수 있는 구매 링크가 없습니다.');
      return;
    }

    try {
      void Linking.openURL(openUrl).catch(() => {
        Alert.alert('오류', '구매 링크를 열 수 없습니다.');
      });
    } catch {
      Alert.alert('오류', '구매 링크를 열 수 없습니다.');
    }
  };

  const visibleDots = getVisibleDotIndexes(mediaItems.length, activeMediaIndex);

  const renderMediaItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const mediaActive = isActive && index === activeMediaIndex;
      const shouldMountVideo = mediaActive
        || (shouldPreloadVideo && index === activeMediaIndex)
        || (isActive && Math.abs(index - activeMediaIndex) <= 1);
      const thumbnailUrl = item.thumbnailUrl ?? groupBuy.thumbnailUrl ?? null;

      return (
        <Animated.View style={[s.mediaPane, { width: mediaStageWidth, height: mediaStageHeight }]}>
          {item.isVideo ? (
            shouldMountVideo ? (
              <VideoSlide
                key={item.url}
                url={item.url}
                isActive={mediaActive}
                thumbnailUrl={thumbnailUrl}
                s={s}
              />
            ) : thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={s.mediaFill} resizeMode="contain" />
            ) : (
              <View style={s.videoPlaceholder}>
                <SText variant="body" style={s.videoPlaceholderText}>동영상</SText>
              </View>
            )
          ) : (
            <Image source={{ uri: item.url }} style={s.mediaFill} resizeMode="contain" />
          )}
        </Animated.View>
      );
    },
    [
      activeMediaIndex,
      groupBuy.thumbnailUrl,
      isActive,
      mediaStageHeight,
      mediaStageWidth,
      s,
      shouldPreloadVideo,
    ],
  );

  return (
    <View style={[s.reelPage, { height: pageHeight }]}>
      <Animated.View
        style={[
          s.mediaStage,
          {
            left: mediaStageLeft,
            right: mediaStageRight,
            top: mediaStageTop,
            bottom: mediaStageBottom,
            borderRadius: mediaStageRadius,
            overflow: 'hidden',
          },
        ]}
      >
        {mediaItems.length > 0 ? (
          <Animated.View style={{ height: mediaStageHeight, overflow: 'hidden' }}>
            <FlashList
              data={mediaItems}
              horizontal
              pagingEnabled
              snapToAlignment="start"
              snapToInterval={isMediaStageCompact ? mediaStageOpenWidth : mediaWidth}
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
                const stepWidth = isMediaStageCompact ? mediaStageOpenWidth : mediaWidth;
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / stepWidth);
                if (nextIndex !== activeMediaIndex && nextIndex >= 0 && nextIndex < mediaItems.length) {
                  setActiveMediaIndex(nextIndex);
                }
              }}
            />
          </Animated.View>
        ) : (
          <View style={s.emptyMedia}>
            <SText variant="body" style={s.emptyMediaText}>미디어 없음</SText>
          </View>
        )}
      </Animated.View>

      <View style={[s.topBar, { paddingTop: topInset + spacing.sm }]}>
        {showBackButton ? (
          <Pressable
            accessibilityLabel="뒤로가기"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [s.topIconButton, pressed && s.pressed]}
          >
            <Text style={s.topIcon}>‹</Text>
          </Pressable>
        ) : (
          <View style={s.topIconButton} />
        )}
        <View style={s.reelsTitleRow}>
          <SText variant="cardTitle" style={s.reelsTitle}>릴스</SText>
        </View>
        <View style={s.topIconButton} />
      </View>

      {mediaItems.length > 1 ? (
        <Animated.View style={[s.mediaDots, { top: topInset + 62, opacity: reelChromeOpacity }]}>
          {visibleDots.map((index) => (
            <View
              key={index}
              style={[
                s.mediaDot,
                index === activeMediaIndex && s.mediaDotActive,
                mediaItems.length > MAX_VISIBLE_DOTS && index === visibleDots[0] && activeMediaIndex > 2 && s.mediaDotFaded,
                mediaItems.length > MAX_VISIBLE_DOTS && index === visibleDots[visibleDots.length - 1] && activeMediaIndex < mediaItems.length - 3 && s.mediaDotFaded,
              ]}
            />
          ))}
        </Animated.View>
      ) : null}

      <>
          <Animated.View pointerEvents={isSummaryExpanded || isSearchSheetVisible ? 'none' : 'auto'} style={[s.rightRail, { bottom: bottomInset + bottomChromeOffset + 104, opacity: reelChromeOpacity }]}>
            <ReelAction
              icon={<Ionicons name={isBookmarked(groupBuy.id) ? 'bookmark' : 'bookmark-outline'} size={26} color={isBookmarked(groupBuy.id) ? colors.accent : '#FFFFFF'} />}
              label={isBookmarked(groupBuy.id) ? '북마크됨' : '북마크'}
              onPress={() => toggleBookmark(groupBuy)}
              s={s}
            />
            <ReelAction icon={<Ionicons name="link-outline" size={26} color="#FFFFFF" />} label="링크" onPress={handleOpenLink} s={s} />
            <ReelAction icon={<Ionicons name="share-social-outline" size={26} color="#FFFFFF" />} label="공유" onPress={handleShare} s={s} />
            <ReelAction
              icon={<Ionicons name={isNotifying(groupBuy.id) ? 'notifications' : 'notifications-outline'} size={26} color={isNotifying(groupBuy.id) ? colors.accent : '#FFFFFF'} />}
              label={isNotifying(groupBuy.id) ? '알림설정됨' : '알림'}
              onPress={() => toggleNotification(groupBuy)}
              s={s}
            />
            <ReelPurchaseAction onPress={handleOpenLink} s={s} />
          </Animated.View>

          <Animated.View pointerEvents={isSummaryExpanded || isSearchSheetVisible ? 'none' : 'auto'} style={[s.bottomInfo, { paddingBottom: bottomInset + bottomChromeOffset + spacing.lg, opacity: reelChromeOpacity }]}>
            <View style={s.bottomInfoScrim} pointerEvents="none" />
            <View style={s.sellerRow}>
              <View style={s.avatar}>
                <SText variant="caption" style={s.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</SText>
              </View>
              <SText variant="cardTitle" style={s.sellerName} numberOfLines={1}>
                {sellerName}
              </SText>
            </View>

            <SText variant="cardTitle" style={s.productName} numberOfLines={2}>
              {groupBuy.productName ?? '제품명 미확인'}
            </SText>

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
                <SText variant="caption" style={s.summaryMore}>더 보기</SText>
              </Pressable>
            ) : null}

            <View style={s.metaRow}>
              <View style={[s.metaPill, isUrgent && !isExpired && s.metaPillUrgent, isExpired && s.metaPillExpired]}>
                <SText variant="caption" style={s.metaPillText}>
                  {isExpired ? '마감' : isUrgent ? '마감 임박' : deadlineLabel}
                </SText>
              </View>
              {groupBuy.category ? (
                <View style={s.metaPill}>
                  <SText variant="caption" style={s.metaPillText}>{groupBuy.category}</SText>
                </View>
              ) : null}
            </View>

          </Animated.View>
      </>

      {summary && isSummaryVisible ? (
        <View style={s.summaryOverlay} pointerEvents="box-none">
          <Pressable
            accessibilityLabel="요약 닫기"
            accessibilityRole="button"
            onPress={() => setSummaryOpen(false)}
            style={s.summaryBackdrop}
          />
          <Animated.View
            onLayout={handleSummarySheetLayout}
            style={[
              s.summarySheet,
              {
                maxHeight: summarySheetMaxHeight,
                paddingBottom: bottomInset + spacing.lg,
                transform: [{ translateY: summarySheetTranslate }],
              },
            ]}
            {...sheetBodyPanResponder.panHandlers}
          >
            <View style={s.summaryHandle} {...handlePanResponder.panHandlers}>
              <View style={s.summaryHandleBar} />
            </View>
            <View style={s.summarySheetHeader}>
              <View style={s.summarySheetSeller}>
                <View style={s.summarySheetAvatar}>
                  <SText variant="caption" style={s.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</SText>
                </View>
                <View style={s.summarySheetTitleBlock}>
                  <SText variant="cardTitle" style={s.summarySheetSellerName} numberOfLines={1}>
                    {sellerName}
                  </SText>
                  <SText variant="caption" style={s.summarySheetProductName} numberOfLines={1}>
                    {groupBuy.productName ?? '제품명 미확인'}
                  </SText>
                </View>
              </View>
            </View>
            <Pressable
              accessibilityLabel={isExpired ? '마감된 공구' : '구매 링크'}
              accessibilityRole="button"
              onPress={handleOpenLink}
              style={({ pressed }) => [
                s.summarySheetBuyButton,
                isExpired && s.summarySheetBuyButtonExpired,
                pressed && !isExpired && s.pressed,
              ]}
            >
              <SText variant="caption" style={s.summarySheetBuyButtonText}>
                {isExpired ? '마감' : '구매 링크'}
              </SText>
            </Pressable>
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
              </GestureScrollView>
            </GestureDetector>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

export function DetailScreen({ route, navigation }: DetailScreenProps) {
  const { groupBuy } = route.params;
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const { recordView } = useRecentViews();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const verticalPagerRef = useRef<PagerView>(null);
  const [summarySheetGate, setSummarySheetGate] = useState({ isOpen: false, canSwipeReel: true });
  const [isScreenFocused, setScreenFocused] = useState(true);
  const [isSearchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSheetMeasuredHeight, setSearchSheetMeasuredHeight] = useState(0);
  const [searchKeyboardHeight, setSearchKeyboardHeight] = useState(0);
  const searchSheetMaxHeight = Math.max(
    280,
    Math.min(screenHeight - insets.top - spacing.xl, screenHeight * 0.70),
  );
  const searchSheetTranslate = useRef(new Animated.Value(searchSheetMaxHeight)).current;
  const searchSheetDragStartY = useRef(0);
  const searchSheetHeightForMedia = Math.max(
    1,
    Math.min(
      (searchSheetMeasuredHeight || searchSheetMaxHeight) + searchKeyboardHeight,
      Math.max(1, screenHeight - (insets.top + 64)),
    ),
  );
  const searchSheetMetrics = useMemo(
    () => (isSearchSheetVisible ? {
      height: searchSheetHeightForMedia,
      translateY: searchSheetTranslate,
    } : null),
    [isSearchSheetVisible, searchSheetHeightForMedia, searchSheetTranslate],
  );

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => setScreenFocused(true));
    const unsubBlur = navigation.addListener('blur', () => setScreenFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  const { data: groupBuys } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const reelItems = useMemo(() => getReelItems(groupBuy, groupBuys), [groupBuy, groupBuys]);
  const initialReelIndex = useMemo(() => getInitialReelIndex(groupBuy, reelItems), [groupBuy.id, reelItems]);
  const [activeProductIndex, setActiveProductIndex] = useState(initialReelIndex);
  const activeGroupBuy = reelItems[activeProductIndex] ?? groupBuy;
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
    const normalized = searchQuery.trim().toLowerCase();
    const source = searchItems.length ? searchItems : [groupBuy];
    if (!normalized) return source.slice(0, 20);
    return source.filter((item) => getSearchText(item).includes(normalized)).slice(0, 30);
  }, [groupBuy, searchItems, searchQuery]);
  useEffect(() => {
    recordView(activeGroupBuy);
  }, [activeGroupBuy, recordView]);
  const handleSummarySheetStateChange = useCallback((isOpen: boolean, canSwipeReel: boolean) => {
    setSummarySheetGate({ isOpen, canSwipeReel });
  }, []);

  useEffect(() => {
    if (!isSearchSheetVisible) {
      searchSheetTranslate.setValue(searchSheetMaxHeight);
    }
  }, [isSearchSheetVisible, searchSheetMaxHeight, searchSheetTranslate]);

  const openSearchSheet = useCallback(() => {
    setSearchSheetVisible(true);
    searchSheetTranslate.stopAnimation();
    searchSheetTranslate.setValue(searchSheetMaxHeight);
    setTimeout(() => {
      Animated.spring(searchSheetTranslate, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 50,
      }).start();
    }, 0);
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const closeSearchSheet = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(searchSheetTranslate, {
      toValue: searchSheetMaxHeight,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSearchSheetVisible(false);
      setSearchKeyboardHeight(0);
    });
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const resetSearchSheetClosed = useCallback(() => {
    Keyboard.dismiss();
    searchSheetTranslate.stopAnimation();
    searchSheetTranslate.setValue(searchSheetMaxHeight);
    setSearchSheetVisible(false);
    setSearchKeyboardHeight(0);
  }, [searchSheetMaxHeight, searchSheetTranslate]);

  const handleSearchSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.min(event.nativeEvent.layout.height, searchSheetMaxHeight);
      setSearchSheetMeasuredHeight((current) => (
        Math.abs(current - nextHeight) < 1 ? current : nextHeight
      ));
    },
    [searchSheetMaxHeight],
  );

  const startSearchSheetDrag = useCallback(() => {
    searchSheetTranslate.stopAnimation((value) => {
      searchSheetDragStartY.current = typeof value === 'number' ? value : 0;
    });
  }, [searchSheetTranslate]);

  const moveSearchSheetDrag = useCallback(
    (dy: number) => {
      const next = searchSheetDragStartY.current + dy;
      searchSheetTranslate.setValue(Math.min(Math.max(next, 0), searchSheetMaxHeight));
    },
    [searchSheetMaxHeight, searchSheetTranslate],
  );

  const finishSearchSheetDrag = useCallback(
    (dy: number, vy: number) => {
      const draggedDown = dy > 12;
      const pastThreshold = dy > Math.max(72, searchSheetMaxHeight * 0.28);
      const flickedDown = vy > 0.65;
      if (draggedDown && (pastThreshold || flickedDown)) {
        closeSearchSheet();
        return;
      }
      Animated.spring(searchSheetTranslate, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 50,
      }).start();
    },
    [closeSearchSheet, searchSheetMaxHeight, searchSheetTranslate],
  );

  useEffect(() => {
    setSummarySheetGate({ isOpen: false, canSwipeReel: true });
  }, [activeProductIndex]);

  useEffect(() => {
    setActiveProductIndex(initialReelIndex);
    verticalPagerRef.current?.setPageWithoutAnimation?.(initialReelIndex);
  }, [initialReelIndex, reelItems.length, groupBuy.id]);

  const handleSelectSearchResult = useCallback((item: GroupBuy) => {
    const nextIndex = reelItems.findIndex((entry) => entry.id === item.id);
    resetSearchSheetClosed();
    setSearchQuery('');
    setSummarySheetGate({ isOpen: false, canSwipeReel: true });
    if (nextIndex >= 0) {
      setActiveProductIndex(nextIndex);
      verticalPagerRef.current?.setPage?.(nextIndex);
      return;
    }
    navigation.push('Detail', { groupBuy: item });
  }, [navigation, reelItems, resetSearchSheetClosed]);

  const renderReelItem = useCallback(
    ({ item, index }: { item: GroupBuy; index: number }) => (
      <ProductReelPage
        key={item.id}
        groupBuy={item}
        isActive={isScreenFocused && index === activeProductIndex}
        isSearchSheetVisible={isSearchSheetVisible}
        searchSheetMetrics={searchSheetMetrics}
        shouldPreloadVideo={Math.abs(index - activeProductIndex) <= 1}
        bottomChromeOffset={DETAIL_SEARCH_CHROME_OFFSET}
        pageHeight={screenHeight}
        mediaWidth={screenWidth}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={() => navigation.goBack()}
        onCloseSearchSheet={closeSearchSheet}
        onSummarySheetStateChange={handleSummarySheetStateChange}
        s={s}
      />
    ),
    [
      activeProductIndex,
      closeSearchSheet,
      handleSummarySheetStateChange,
      insets.bottom,
      insets.top,
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
        ref={verticalPagerRef}
        initialPage={initialReelIndex}
        offscreenPageLimit={1}
        onPageSelected={(event) => {
          const nextIndex = event.nativeEvent.position;
          if (nextIndex !== activeProductIndex && nextIndex >= 0 && nextIndex < reelItems.length) {
            setActiveProductIndex(nextIndex);
          }
        }}
        orientation="vertical"
        overdrag
        scrollEnabled={screenHeight > 0 && reelItems.length > 1 && !summarySheetGate.isOpen && !isSearchSheetVisible}
        style={s.verticalPager}
      >
        {reelItems.map((item, index) => (
          <View
            key={item.id}
            collapsable={false}
            style={[
              s.verticalPagerPage,
              {
                height: screenHeight,
              },
            ]}
          >
            {renderReelItem({ item, index })}
          </View>
        ))}
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
          maxHeight={searchSheetMaxHeight}
          onClose={closeSearchSheet}
          onKeyboardHeightChange={setSearchKeyboardHeight}
          onSheetDragEnd={finishSearchSheetDrag}
          onSheetDragMove={moveSearchSheetDrag}
          onSheetDragStart={startSearchSheetDrag}
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

export function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#05070A' },
    verticalPager: {
      backgroundColor: '#05070A',
      flex: 1,
      overflow: 'hidden',
    },
    verticalPagerPage: {
      backgroundColor: '#05070A',
      width: '100%',
    },
    detailSearchDock: {
      bottom: 0,
      left: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      position: 'absolute',
      right: 0,
      zIndex: 20,
    },
    detailSearchButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(24,27,33,0.92)',
      borderColor: 'rgba(255,255,255,0.10)',
      borderRadius: 28,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      height: 54,
      paddingHorizontal: spacing.lg,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
      ...shadows.md,
    },
    detailSearchButtonText: {
      color: 'rgba(255,255,255,0.72)',
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    detailSearchOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 40,
    },
    detailSearchBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    detailSearchKeyboard: {
      justifyContent: 'flex-end',
    },
    detailSearchSheet: {
      backgroundColor: '#1F2229',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '70%',
      minHeight: 360,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    detailSearchHandle: {
      alignSelf: 'center',
      backgroundColor: 'rgba(255,255,255,0.42)',
      borderRadius: 999,
      height: 4,
      marginBottom: spacing.lg,
      width: 52,
    },
    detailSearchHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: spacing.md,
    },
    detailSearchTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
    },
    detailSearchInputWrap: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      height: 48,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    detailSearchInput: {
      color: '#FFFFFF',
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      padding: 0,
    },
    detailSearchList: {
      flexGrow: 0,
    },
    detailSearchResult: {
      alignItems: 'center',
      borderBottomColor: 'rgba(255,255,255,0.08)',
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 70,
      paddingVertical: spacing.sm,
    },
    detailSearchThumb: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      height: 52,
      width: 52,
    },
    detailSearchThumbFallback: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    detailSearchResultBody: {
      flex: 1,
      minWidth: 0,
    },
    detailSearchResultTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 3,
    },
    detailSearchResultMeta: {
      color: 'rgba(255,255,255,0.56)',
      fontSize: 12,
      fontWeight: '700',
    },
    detailSearchEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 150,
    },
    detailSearchEmptyText: {
      color: 'rgba(255,255,255,0.58)',
      fontWeight: '700',
    },
    reelPage: {
      backgroundColor: '#05070A',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    mediaStage: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#05070A',
    },
    mediaStageWithSheet: {
      borderRadius: 22,
      left: MEDIA_STAGE_SIDE_INSET,
      overflow: 'hidden',
      right: MEDIA_STAGE_SIDE_INSET,
    },
    mediaScroller: { flex: 1 },
    mediaPane: {
      backgroundColor: '#05070A',
      height: '100%',
    },
    mediaFill: {
      height: '100%',
      width: '100%',
    },
    videoSlide: {
      height: '100%',
      position: 'relative',
      width: '100%',
    },
    videoPoster: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    videoTapLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    videoControlsOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },
    muteOverlayButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginBottom: spacing.sm,
      width: 40,
    },
    playOverlayButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.46)',
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 38,
      borderWidth: 1,
      height: 76,
      justifyContent: 'center',
      width: 76,
    },
    emptyMedia: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    emptyMediaText: { color: 'rgba(255,255,255,0.72)' },
    videoPlaceholder: {
      alignItems: 'center',
      backgroundColor: '#05070A',
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },
    videoPlaceholderText: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 14,
      fontWeight: '800',
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      left: 0,
      paddingHorizontal: spacing.lg,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    topIconButton: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    topIcon: {
      color: '#FFFFFF',
      fontSize: 42,
      fontWeight: '300',
      lineHeight: 44,
    },
    reelsTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xl,
    },
    reelsTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.36)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    mediaDots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      left: spacing.xl,
      position: 'absolute',
      right: spacing.xl,
    },
    mediaDot: {
      backgroundColor: 'rgba(255,255,255,0.42)',
      borderRadius: 2,
      height: 3,
      width: 28,
    },
    mediaDotActive: { backgroundColor: '#FFFFFF' },
    mediaDotFaded: { opacity: 0.46, width: 16 },
    rightRail: {
      alignItems: 'center',
      gap: spacing.sm,
      position: 'absolute',
      right: spacing.md,
      width: 58,
    },
    railButton: {
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
      width: 52,
    },
    purchaseRailButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderColor: 'rgba(255,255,255,0.48)',
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 54,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      width: 58,
      ...shadows.sm,
    },
    railIcon: {
      color: '#FFFFFF',
      fontSize: 34,
      fontWeight: '500',
      lineHeight: 38,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.44)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    railIconBox: {
      alignItems: 'center',
      height: 34,
      justifyContent: 'center',
      width: 52,
    },
    purchaseGlyph: {
      height: 22,
      position: 'relative',
      width: 22,
    },
    purchaseLinkRingA: {
      borderColor: '#FFFFFF',
      borderRadius: 6,
      borderWidth: 2,
      height: 9,
      left: 2,
      position: 'absolute',
      top: 8,
      transform: [{ rotate: '-32deg' }],
      width: 13,
    },
    purchaseLinkRingB: {
      borderColor: colors.accent,
      borderRadius: 6,
      borderWidth: 2,
      height: 9,
      position: 'absolute',
      right: 2,
      top: 5,
      transform: [{ rotate: '-32deg' }],
      width: 13,
    },
    purchaseLinkBridge: {
      backgroundColor: '#FFFFFF',
      borderRadius: 999,
      height: 2,
      left: 8,
      position: 'absolute',
      top: 11,
      transform: [{ rotate: '-32deg' }],
      width: 7,
    },
    purchaseRailLabel: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      lineHeight: 12,
      marginTop: 1,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.18)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    railLabel: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
      marginTop: 2,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.44)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    bottomInfo: {
      bottom: 0,
      left: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      position: 'absolute',
      right: 76,
    },
    bottomInfoScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      borderTopRightRadius: 18,
    },
    sellerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    avatar: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: 'rgba(255,255,255,0.92)',
      borderRadius: borderRadius.full,
      borderWidth: 2,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },
    sellerName: {
      color: '#FFFFFF',
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.42)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    productName: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
      marginBottom: 4,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryPreview: {
      alignSelf: 'stretch',
      marginBottom: spacing.xs,
    },
    summary: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryMore: {
      alignSelf: 'flex-start',
      color: 'rgba(255,255,255,0.74)',
      fontSize: 13,
      fontWeight: '800',
      marginTop: 0,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: 0,
    },
    metaPill: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderColor: 'rgba(255,255,255,0.22)',
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    metaPillUrgent: { backgroundColor: 'rgba(255,59,48,0.72)', borderColor: 'rgba(255,255,255,0.24)' },
    metaPillExpired: { backgroundColor: 'rgba(142,142,147,0.64)', borderColor: 'rgba(255,255,255,0.18)' },
    metaPillText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    summaryOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 30,
    },
    summaryBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    summarySheet: {
      backgroundColor: '#111417',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    summaryHandle: {
      alignItems: 'center',
      // Generous touch target so the sheet is easy to grab and drag down.
      height: 28,
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    summaryHandleBar: {
      alignSelf: 'center',
      backgroundColor: 'rgba(255,255,255,0.62)',
      borderRadius: 2,
      height: 5,
      width: 58,
    },
    summarySheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    summarySheetSeller: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      minWidth: 0,
    },
    summarySheetAvatar: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: 'rgba(255,255,255,0.92)',
      borderRadius: borderRadius.full,
      borderWidth: 2,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    summarySheetTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    summarySheetSellerName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    summarySheetProductName: {
      color: 'rgba(255,255,255,0.66)',
      fontSize: 13,
      fontWeight: '500',
      marginTop: 2,
    },
    summarySheetBuyButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: '#FFFFFF',
      borderRadius: borderRadius.full,
      height: 32,
      justifyContent: 'center',
      marginBottom: spacing.lg,
      minWidth: 88,
      paddingHorizontal: spacing.md,
    },
    summarySheetBuyButtonExpired: {
      backgroundColor: 'rgba(255,255,255,0.36)',
    },
    summarySheetBuyButtonText: {
      color: '#111318',
      fontSize: 12,
      fontWeight: '700',
    },
    summaryScroll: {
      flexGrow: 0,
    },
    summarySheetText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 22,
      paddingBottom: spacing.xl,
    },
    pressed: { opacity: 0.72 },
  });
}
