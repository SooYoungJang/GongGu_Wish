import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InputStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UrlInputStatusProps {
  status: InputStatus;
}

// ─── Loading Dots ────────────────────────────────────────────────────────────

const DOT_COUNT = 3;
const DOT_SIZE = 6;
const DOT_ANIM_MS = 600;

function LoadingDots({ colors }: { colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Create 3 Animated.Values, once per mount
  const opacitiesRef = useRef<Animated.Value[] | null>(null);
  if (!opacitiesRef.current) {
    opacitiesRef.current = Array.from(
      { length: DOT_COUNT },
      () => new Animated.Value(0.3),
    );
  }
  const opacities = opacitiesRef.current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled: boolean) => {
      setReducedMotion(enabled);
    });
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      opacities.forEach((o) => o.setValue(1));
      return;
    }

    // Each dot: delay → fade up → fade down → loop
    const sequences = opacities.map((opacity, i) =>
      Animated.sequence([
        Animated.delay(i * (DOT_ANIM_MS / 2)),
        Animated.timing(opacity, {
          toValue: 1,
          duration: DOT_ANIM_MS / 2,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: DOT_ANIM_MS / 2,
          useNativeDriver: false,
        }),
      ]),
    );

    const loop = Animated.loop(Animated.parallel(sequences));
    loop.start();

    return () => {
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <View style={s.loadingContainer}>
      {opacities.map((opacity, i) => (
        <Animated.View
          key={i}
          style={[s.dot, { opacity: opacity as unknown as number }]}
        />
      ))}
    </View>
  );
}

// ─── Status Icon ─────────────────────────────────────────────────────────────

function SuccessIcon({ colors }: { colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.iconContainer, s.successContainer]}>
      <SText variant="caption" style={s.iconText}>
        {'\u2713'}
      </SText>
    </View>
  );
}

function ErrorIcon({ colors }: { colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.iconContainer, s.errorContainer]}>
      <SText variant="caption" style={s.iconText}>
        {'\u2715'}
      </SText>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UrlInputStatus({ status }: UrlInputStatusProps) {
  const { colors } = useTheme();

  switch (status) {
    case 'loading':
      return <LoadingDots colors={colors} />;
    case 'success':
      return <SuccessIcon colors={colors} />;
    case 'error':
      return <ErrorIcon colors={colors} />;
    case 'idle':
    default:
      return null;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      marginLeft: spacing.sm,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: colors.primary,
    },
    iconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    successContainer: {
      backgroundColor: colors.primary,
    },
    errorContainer: {
      backgroundColor: colors.error,
    },
    iconText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
    },
  });
}
