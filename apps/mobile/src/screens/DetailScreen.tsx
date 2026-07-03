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
  Pressable,
  ScrollView,
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

import { fetchGroupBuys } from '../api';
import { SText } from '../components/ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { DetailScreenProps, GroupBuy } from '../types';
import { formatEndDate, getDaysRemaining } from '../utils';

const MAX_VISIBLE_DOTS = 5;
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.m3u8', '.mkv', '.avi', '.ts'];

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
  const seen = new Set<string>();
  const ordered = [current, ...(fetched ?? [])];

  return ordered.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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

type ProductReelPageProps = {
  groupBuy: GroupBuy;
  isActive: boolean;
  pageHeight: number;
  mediaWidth: number;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  onSummarySheetStateChange: (isOpen: boolean, canSwipeReel: boolean) => void;
  s: ReturnType<typeof makeStyles>;
};

function ProductReelPage({
  groupBuy,
  isActive,
  pageHeight,
  mediaWidth,
  topInset,
  bottomInset,
  onBack,
  onSummarySheetStateChange,
  s,
}: ProductReelPageProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isSummaryExpanded, setSummaryExpanded] = useState(false);
  const [summaryScrollContentHeight, setSummaryScrollContentHeight] = useState(0);
  const [summaryScrollViewportHeight, setSummaryScrollViewportHeight] = useState(0);
  const [isSummaryScrollAtTop, setSummaryScrollAtTop] = useState(true);
  const summaryScrollOffsetRef = useRef(0);
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
  const canHandOffSummaryScroll = useCallback(
    (offsetY: number, viewportHeight = summaryScrollViewportHeight, contentHeight = summaryScrollContentHeight) => {
      if (viewportHeight <= 0 || contentHeight <= 0) return false;
      if (contentHeight <= viewportHeight + 2) return true;

      const maxOffsetY = Math.max(0, contentHeight - viewportHeight);
      return offsetY <= 2 || offsetY >= maxOffsetY - 2;
    },
    [summaryScrollContentHeight, summaryScrollViewportHeight],
  );

  const setSummaryOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setSummaryExpanded(true);
        setSummaryVisible(true);
        Animated.spring(summarySheetTranslate, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 50,
        }).start();
      } else {
        Animated.timing(summarySheetTranslate, {
          toValue: summarySheetMaxHeight,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setSummaryExpanded(false);
          setSummaryVisible(false);
          summaryScrollOffsetRef.current = 0;
          setSummaryScrollAtTop(true);
          summarySheetTranslate.setValue(summarySheetMaxHeight);
        });
      }
      onSummarySheetStateChange(isOpen, false);
    },
    [onSummarySheetStateChange, summarySheetMaxHeight, summarySheetTranslate],
  );

  useEffect(() => {
    if (!isActive && isSummaryExpanded) {
      setSummaryExpanded(false);
      onSummarySheetStateChange(false, true);
    }
  }, [isActive, isSummaryExpanded, onSummarySheetStateChange]);

  const handleSummaryScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const nextOffset = event.nativeEvent.contentOffset.y;
      summaryScrollOffsetRef.current = nextOffset;
      setSummaryScrollAtTop(nextOffset <= 0);
      onSummarySheetStateChange(true, canHandOffSummaryScroll(event.nativeEvent.contentOffset.y));
    },
    [canHandOffSummaryScroll, isSummaryExpanded, onSummarySheetStateChange],
  );

  const handleSummaryScrollLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      setSummaryScrollViewportHeight(nextHeight);
      if (isSummaryExpanded) {
        onSummarySheetStateChange(true, canHandOffSummaryScroll(0, nextHeight, summaryScrollContentHeight));
      }
    },
    [canHandOffSummaryScroll, isSummaryExpanded, onSummarySheetStateChange, summaryScrollContentHeight],
  );

  const handleSummaryContentSizeChange = useCallback(
    (_width: number, height: number) => {
      setSummaryScrollContentHeight(height);
      if (isSummaryExpanded) {
        onSummarySheetStateChange(true, canHandOffSummaryScroll(0, summaryScrollViewportHeight, height));
      }
    },
    [canHandOffSummaryScroll, isSummaryExpanded, onSummarySheetStateChange, summaryScrollViewportHeight],
  );

  const DISMISS_VELOCITY_THRESHOLD = 0.5;

  const summaryContentFitsViewport = summaryScrollContentHeight > 0
    && summaryScrollContentHeight <= summaryScrollViewportHeight + 2;

  // bounces true at the top so iOS shows an overscroll drag the dismiss handler closes on release.
  const summaryBounces = isSummaryExpanded && (isSummaryScrollAtTop || summaryContentFitsViewport);

  const handleSummaryScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSummaryExpanded) return;
      const { y } = event.nativeEvent.contentOffset;
      const velocity = event.nativeEvent.velocity?.y ?? 0;
      const atTop = y <= 0;
      const pullingDown = velocity > DISMISS_VELOCITY_THRESHOLD;
      if ((atTop && pullingDown) || summaryContentFitsViewport) {
        setSummaryOpen(false);
      }
    },
    [
      isSummaryExpanded,
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
        <View style={[s.mediaPane, { width: mediaWidth }]}>
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
        </View>
      );
    },
    [activeMediaIndex, groupBuy.thumbnailUrl, isActive, mediaWidth, s],
  );

  return (
    <View style={[s.reelPage, { height: pageHeight }]}>
      <View
        style={[
          s.mediaStage,
          isSummaryExpanded && [
            s.mediaStageWithSheet,
            {
              bottom: summarySheetMaxHeight + spacing.md,
              top: topInset + 64,
            },
          ],
        ]}
      >
        {mediaItems.length > 0 ? (
          <FlashList
            data={mediaItems}
            horizontal
            pagingEnabled
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
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / mediaWidth);
              if (nextIndex !== activeMediaIndex && nextIndex >= 0 && nextIndex < mediaItems.length) {
                setActiveMediaIndex(nextIndex);
              }
            }}
          />
        ) : (
          <View style={s.emptyMedia}>
            <SText variant="body" style={s.emptyMediaText}>미디어 없음</SText>
          </View>
        )}
      </View>

      <View style={s.scrimTop} pointerEvents="none" />
      <View style={s.scrimBottom} pointerEvents="none" />

      <View style={[s.topBar, { paddingTop: topInset + spacing.sm }]}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [s.topIconButton, pressed && s.pressed]}
        >
          <Text style={s.topIcon}>‹</Text>
        </Pressable>
        <View style={s.reelsTitleRow}>
          <SText variant="cardTitle" style={s.reelsTitle}>릴스</SText>
        </View>
        <View style={s.topIconButton} />
      </View>

      {mediaItems.length > 1 && !isSummaryExpanded ? (
        <View style={[s.mediaDots, { top: topInset + 62 }]}>
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
        </View>
      ) : null}

      {!isSummaryExpanded ? (
        <>
          <View style={[s.rightRail, { bottom: bottomInset + 132 }]}>
            <ReelAction icon="♡" label="관심" onPress={handleSave} s={s} />
            <ReelAction icon="○" label="링크" onPress={handleOpenLink} s={s} />
            <ReelAction icon="↗" label="공유" onPress={handleShare} s={s} />
            <ReelAction icon="⌑" label="저장" onPress={handleSave} s={s} />
          </View>

          <View style={[s.bottomInfo, { paddingBottom: bottomInset + spacing.lg }]}>
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
          </View>
        </>
      ) : null}

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
          >
            <View style={s.summaryHandle} />
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
              <Pressable
                accessibilityLabel="요약 창 닫기"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setSummaryOpen(false)}
                style={({ pressed }) => [s.summaryCloseButton, pressed && s.pressed]}
              >
                <Text style={s.summaryCloseIcon}>×</Text>
              </Pressable>
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
            <ScrollView
              bounces={summaryBounces}
              nestedScrollEnabled
              onContentSizeChange={handleSummaryContentSizeChange}
              onLayout={handleSummaryScrollLayout}
              onScroll={handleSummaryScroll}
              onScrollEndDrag={handleSummaryScrollEndDrag}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={s.summaryScroll}
            >
              <SText variant="body" style={s.summarySheetText}>
                {summary}
              </SText>
            </ScrollView>
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
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [summarySheetGate, setSummarySheetGate] = useState({ isOpen: false, canSwipeReel: true });

  const { data: groupBuys } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const reelItems = useMemo(() => getReelItems(groupBuy, groupBuys), [groupBuy, groupBuys]);
  const handleSummarySheetStateChange = useCallback((isOpen: boolean, canSwipeReel: boolean) => {
    setSummarySheetGate({ isOpen, canSwipeReel });
  }, []);

  useEffect(() => {
    setSummarySheetGate({ isOpen: false, canSwipeReel: true });
  }, [activeProductIndex]);

  const renderReelItem = useCallback(
    ({ item, index }: { item: GroupBuy; index: number }) => (
      <ProductReelPage
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
    [activeProductIndex, handleSummarySheetStateChange, insets.bottom, insets.top, navigation, s, screenHeight, screenWidth],
  );

  return (
    <View style={s.safeArea}>
      <StatusBar barStyle="light-content" />
      <FlashList
        data={reelItems}
        keyExtractor={(item) => item.id}
        renderItem={renderReelItem}
        pagingEnabled
        scrollEnabled={!summarySheetGate.isOpen || summarySheetGate.canSwipeReel}
        showsVerticalScrollIndicator={false}
        style={s.verticalScroller}
        decelerationRate="fast"
        disableIntervalMomentum
        drawDistance={screenHeight}
        maxItemsInRecyclePool={2}
        maintainVisibleContentPosition={{ disabled: true }}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.y / screenHeight);
          if (nextIndex !== activeProductIndex && nextIndex >= 0 && nextIndex < reelItems.length) {
            setActiveProductIndex(nextIndex);
          }
        }}
      />
    </View>
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#05070A' },
    verticalScroller: { backgroundColor: '#05070A', flex: 1 },
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
      left: 48,
      overflow: 'hidden',
      right: 48,
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
      alignSelf: 'center',
      backgroundColor: 'rgba(255,255,255,0.62)',
      borderRadius: 2,
      height: 4,
      marginBottom: spacing.lg,
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
    summaryCloseButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      marginLeft: spacing.md,
      width: 40,
    },
    summaryCloseIcon: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '300',
      lineHeight: 28,
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
