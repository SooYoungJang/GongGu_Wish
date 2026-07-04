import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  Image,
  Linking,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
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

// When the summary sheet is open the media stage shrinks to a centered card
// with this much inset on each side.
const MEDIA_STAGE_SIDE_INSET = 48;
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
  s: ReturnType<typeof makeStyles>;
};

const VideoSlide = memo(function VideoSlide({ url, isActive, s }: VideoSlideProps) {
  const [shouldPlay, setShouldPlay] = useState(true);
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

  useEffect(() => {
    player.muted = false;
    player.volume = 1;
    player.audioMixingMode = 'doNotMix';

    if (isActive && shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, shouldPlay]);

  const togglePlayback = useCallback(() => {
    setShouldPlay((current) => {
      const next = !current;
      player.muted = false;
      player.volume = 1;
      player.audioMixingMode = 'doNotMix';

      if (next && isActive) {
        player.play();
      } else {
        player.pause();
      }
      return next;
    });
  }, [isActive, player]);

  return (
    <View style={s.videoSlide}>
      <VideoView
        player={player}
        style={s.mediaFill}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
        onFirstFrameRender={() => {
          player.muted = false;
          player.volume = 1;
          player.audioMixingMode = 'doNotMix';
          if (isActive && shouldPlay) player.play();
        }}
      />
      <Pressable
        accessibilityLabel={shouldPlay ? '동영상 일시정지' : '동영상 재생'}
        accessibilityRole="button"
        onPress={togglePlayback}
        pressRetentionOffset={24}
        style={s.videoTapLayer}
      />
      {!shouldPlay ? (
        <View style={s.pauseOverlay} pointerEvents="none">
          <Text style={s.pauseIcon}>▶</Text>
        </View>
      ) : null}
    </View>
  );
});

type ReelActionProps = {
  icon: string;
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
      <Text style={s.railIcon}>{icon}</Text>
      <SText variant="caption" style={s.railLabel}>{label}</SText>
    </Pressable>
  );
}

export type ProductReelPageProps = {
  groupBuy: GroupBuy;
  isActive: boolean;
  pageHeight: number;
  mediaWidth: number;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  showBackButton?: boolean;
  // eslint-disable-next-line no-unused-vars
  onSummarySheetStateChange(isOpen: boolean, canSwipeReel: boolean): void;
  s: ReturnType<typeof makeStyles>;
};

export function ProductReelPage({
  groupBuy,
  isActive,
  pageHeight,
  mediaWidth,
  topInset,
  bottomInset,
  onBack,
  showBackButton = true,
  onSummarySheetStateChange,
  s,
}: ProductReelPageProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isSummaryExpanded, setSummaryExpanded] = useState(false);
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
  const mediaItems = useMemo(() => getDisplayMedia(groupBuy), [groupBuy]);
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
  // 0 = sheet fully open, 1 = sheet fully closed. Drives the media stage size
  // so it smoothly grows/shrinks in sync with the sheet position.
  const sheetProgress = useRef(
    summarySheetTranslate.interpolate({
      inputRange: [0, summarySheetMaxHeight],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  ).current;
  // Media stage interpolations: 0 (open) -> collapsed card, 1 (closed) -> full screen.
  const mediaStageOpenWidth = mediaWidth - MEDIA_STAGE_SIDE_INSET * 2;
  const mediaStageOpenHeight = Math.max(
    0,
    pageHeight - (topInset + 64) - (summarySheetMaxHeight + spacing.md),
  );
  const animatedMediaStageWidth = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [mediaStageOpenWidth, mediaWidth],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageHeight = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [mediaStageOpenHeight, pageHeight],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageTop = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [topInset + 64, 0],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageBottom = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [summarySheetMaxHeight + spacing.md, 0],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageRadius = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [22, 0],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageLeft = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [MEDIA_STAGE_SIDE_INSET, 0],
      extrapolate: 'clamp',
    }),
  ).current;
  const animatedMediaStageRight = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [MEDIA_STAGE_SIDE_INSET, 0],
      extrapolate: 'clamp',
    }),
  ).current;
  // Reel chrome (right rail, bottom info, dots) fades with the sheet: visible
  // when closed, hidden when the sheet is open.
  const animatedReelChromeOpacity = useRef(
    sheetProgress.interpolate({
      inputRange: [0, 0.35],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  ).current;

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
      useNativeDriver: true,
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
          useNativeDriver: true,
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
      Alert.alert('마감된 공구', '이 공구는 마감되었습니다.');
      return;
    }

    void Linking.openURL(groupBuy.purchaseUrl ?? groupBuy.rawPost.postUrl);
  };

  const handleSave = () => {
    Alert.alert('준비 중', '관심 공구 저장 기능은 준비 중입니다.');
  };

  const visibleDots = getVisibleDotIndexes(mediaItems.length, activeMediaIndex);

  const renderMediaItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const mediaActive = isActive && index === activeMediaIndex;

      return (
        <Animated.View style={[s.mediaPane, { width: animatedMediaStageWidth, height: animatedMediaStageHeight }]}>
          {item.isVideo ? (
            mediaActive ? (
              <VideoSlide
                url={item.url}
                isActive={mediaActive}
                s={s}
              />
            ) : item.thumbnailUrl ?? groupBuy.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl ?? groupBuy.thumbnailUrl ?? '' }} style={s.mediaFill} resizeMode="contain" />
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
    [activeMediaIndex, animatedMediaStageHeight, animatedMediaStageWidth, groupBuy.thumbnailUrl, isActive, s],
  );

  return (
    <View style={[s.reelPage, { height: pageHeight }]}>
      <Animated.View
        style={[
          s.mediaStage,
          {
            left: animatedMediaStageLeft,
            right: animatedMediaStageRight,
            top: animatedMediaStageTop,
            bottom: animatedMediaStageBottom,
            borderRadius: animatedMediaStageRadius,
            overflow: 'hidden',
          },
        ]}
      >
        {mediaItems.length > 0 ? (
          <Animated.View style={{ height: animatedMediaStageHeight, overflow: 'hidden' }}>
            <FlashList
              data={mediaItems}
              horizontal
              pagingEnabled
              snapToAlignment="start"
              snapToInterval={isSummaryExpanded ? mediaStageOpenWidth : mediaWidth}
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
                const stepWidth = isSummaryExpanded ? mediaStageOpenWidth : mediaWidth;
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

      <View style={s.scrimTop} pointerEvents="none" />
      <View style={s.scrimBottom} pointerEvents="none" />

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
        <Animated.View style={[s.mediaDots, { top: topInset + 62, opacity: animatedReelChromeOpacity }]}>
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
          <Animated.View pointerEvents={isSummaryExpanded ? 'none' : 'auto'} style={[s.rightRail, { bottom: bottomInset + 132, opacity: animatedReelChromeOpacity }]}>
            <ReelAction icon="♡" label="관심" onPress={handleSave} s={s} />
            <ReelAction icon="○" label="링크" onPress={handleOpenLink} s={s} />
            <ReelAction icon="↗" label="공유" onPress={handleShare} s={s} />
            <ReelAction icon="⌑" label="저장" onPress={handleSave} s={s} />
          </Animated.View>

          <Animated.View pointerEvents={isSummaryExpanded ? 'none' : 'auto'} style={[s.bottomInfo, { paddingBottom: bottomInset + spacing.lg, opacity: animatedReelChromeOpacity }]}>
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
                <SText variant="body" style={s.summary} numberOfLines={2}>
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

            <Pressable
              accessibilityLabel={isExpired ? '마감된 공구' : '구매 링크 열기'}
              accessibilityRole="button"
              onPress={handleOpenLink}
              style={({ pressed }) => [s.buyButton, isExpired && s.buyButtonExpired, pressed && !isExpired && s.pressed]}
            >
              <SText variant="label" style={s.buyButtonText}>
                {isExpired ? '마감된 공구' : '구매 링크 열기'}
              </SText>
            </Pressable>
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
              accessibilityLabel={isExpired ? '마감된 공구' : '구매 링크 열기'}
              accessibilityRole="button"
              onPress={handleOpenLink}
              style={({ pressed }) => [
                s.summarySheetBuyButton,
                isExpired && s.summarySheetBuyButtonExpired,
                pressed && !isExpired && s.pressed,
              ]}
            >
              <SText variant="caption" style={s.summarySheetBuyButtonText}>
                {isExpired ? '마감' : '구매링크'}
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const verticalPagerRef = useRef<PagerView>(null);
  const [summarySheetGate, setSummarySheetGate] = useState({ isOpen: false, canSwipeReel: true });

  const { data: groupBuys } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const reelItems = useMemo(() => getReelItems(groupBuy, groupBuys), [groupBuy, groupBuys]);
  const initialReelIndex = useMemo(() => getInitialReelIndex(groupBuy, reelItems), [groupBuy.id, reelItems]);
  const [activeProductIndex, setActiveProductIndex] = useState(initialReelIndex);
  const handleSummarySheetStateChange = useCallback((isOpen: boolean, canSwipeReel: boolean) => {
    setSummarySheetGate({ isOpen, canSwipeReel });
  }, []);

  useEffect(() => {
    setSummarySheetGate({ isOpen: false, canSwipeReel: true });
  }, [activeProductIndex]);

  useEffect(() => {
    setActiveProductIndex(initialReelIndex);
    verticalPagerRef.current?.setPageWithoutAnimation?.(initialReelIndex);
  }, [initialReelIndex, reelItems.length, groupBuy.id]);

  const renderReelItem = useCallback(
    ({ item, index }: { item: GroupBuy; index: number }) => (
      <ProductReelPage
        key={item.id}
        groupBuy={item}
        isActive={index === activeProductIndex}
        pageHeight={screenHeight}
        mediaWidth={screenWidth}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={() => navigation.goBack()}
        onSummarySheetStateChange={handleSummarySheetStateChange}
        s={s}
      />
    ),
    [
      activeProductIndex,
      handleSummarySheetStateChange,
      insets.bottom,
      insets.top,
      navigation,
      s,
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
        scrollEnabled={screenHeight > 0 && reelItems.length > 1 && !summarySheetGate.isOpen}
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
    videoTapLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
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
    pauseOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.24)',
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      left: '50%',
      marginLeft: -34,
      marginTop: -34,
      position: 'absolute',
      top: '50%',
      width: 68,
    },
    pauseIcon: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '800',
      marginLeft: 4,
    },
    scrimTop: {
      backgroundColor: 'rgba(0,0,0,0.20)',
      height: 96,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    scrimBottom: {
      backgroundColor: 'rgba(0,0,0,0.34)',
      bottom: 0,
      height: 230,
      left: 0,
      position: 'absolute',
      right: 0,
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
      gap: spacing.lg,
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
      paddingTop: spacing.xl,
      position: 'absolute',
      right: 76,
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
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
      marginBottom: 4,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryPreview: {
      alignSelf: 'stretch',
      marginBottom: spacing.sm,
    },
    summary: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    summaryMore: {
      alignSelf: 'flex-start',
      color: 'rgba(255,255,255,0.74)',
      fontSize: 13,
      fontWeight: '800',
      marginTop: 2,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
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
    buyButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      height: 42,
      justifyContent: 'center',
      minWidth: 150,
      paddingHorizontal: spacing.lg,
      ...shadows.sm,
    },
    buyButtonExpired: { backgroundColor: 'rgba(255,255,255,0.42)' },
    buyButtonText: {
      color: '#111318',
      fontSize: 14,
      fontWeight: '900',
    },
    summaryOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 30,
    },
    summaryBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
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
