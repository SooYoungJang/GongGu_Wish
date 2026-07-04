import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import PagerView from 'react-native-pager-view';

import { fetchGroupBuys, fallbackGroupBuys } from '../api';
import { useTheme } from '../context/ThemeContext';
import type { GroupBuy } from '../types';
import { ProductReelPage, makeStyles } from './DetailScreen';

// Fisher-Yates shuffle so each visit to the Reels tab shows feeds in a
// different random order, like shuffling a playlist.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ReelsScreen() {
  const { colors, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [summarySheetGate, setSummarySheetGate] = useState({ isOpen: false, canSwipeReel: true });

  const { data } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  // Base shuffled batch, refreshed each time data arrives.
  const baseBatch = useMemo<GroupBuy[]>(() => {
    const items = data?.length ? data : fallbackGroupBuys;
    return shuffle(items);
  }, [data]);

  // Infinite scroll: append a fresh shuffled batch whenever the user gets
  // close to the end so reels never run out.
  const [reelItems, setReelItems] = useState<GroupBuy[]>([]);
  const batchCounter = useRef(0);

  useEffect(() => {
    if (baseBatch.length === 0) return;
    batchCounter.current = 0;
    setReelItems([...baseBatch]);
    setActiveIndex(0);
  }, [baseBatch]);

  const appendBatch = useCallback(() => {
    batchCounter.current += 1;
    setReelItems((prev) => [...prev, ...shuffle(baseBatch)]);
  }, [baseBatch]);

  // When the active index nears the end, append another batch.
  useEffect(() => {
    if (reelItems.length === 0) return;
    if (activeIndex >= reelItems.length - 2) {
      appendBatch();
    }
  }, [activeIndex, reelItems.length, appendBatch]);

  const handleSummarySheetStateChange = useCallback((isOpen: boolean, canSwipeReel: boolean) => {
    setSummarySheetGate({ isOpen, canSwipeReel });
  }, []);

  const renderReelItem = useCallback(
    (item: GroupBuy, index: number) => (
      <ProductReelPage
        key={item.id}
        groupBuy={item}
        isActive={index === activeIndex}
        pageHeight={screenHeight}
        mediaWidth={screenWidth}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onBack={() => {}}
        showBackButton={false}
        onSummarySheetStateChange={handleSummarySheetStateChange}
        s={s}
      />
    ),
    [activeIndex, handleSummarySheetStateChange, insets.bottom, insets.top, s, screenHeight, screenWidth],
  );

  if (reelItems.length === 0) {
    return (
      <View style={styles.empty}>
        <StatusBar barStyle="light-content" />
      </View>
    );
  }

  return (
    <View style={s.safeArea}>
      <StatusBar barStyle="light-content" />
      <PagerView
        ref={pagerRef}
        initialPage={0}
        offscreenPageLimit={1}
        onPageSelected={(event) => {
          const next = event.nativeEvent.position;
          if (next !== activeIndex) setActiveIndex(next);
        }}
        orientation="vertical"
        overdrag
        scrollEnabled={screenHeight > 0 && reelItems.length > 1 && !summarySheetGate.isOpen}
        style={s.verticalPager}
      >
        {reelItems.map((item, index) => (
          <View
            key={`${item.id}-${index}`}
            collapsable={false}
            style={[s.verticalPagerPage, { height: screenHeight }]}
          >
            {renderReelItem(item, index)}
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, backgroundColor: '#05070A' },
});
