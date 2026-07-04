import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InputStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UrlInputStatusProps {
  status: InputStatus;
}

// ─── Loading Dots ────────────────────────────────────────────────────────────

const DOT_COUNT = 3;
const DOT_SIZE = 6;
const DOT_ANIM_MS = 600;

function LoadingDots() {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [reducedMotion, setReducedMotion] = useState(false);

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
  }, [opacities, reducedMotion]);

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

function SuccessIcon() {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.iconContainer, s.successContainer]}>
      <SText variant="caption" style={s.iconText}>
        {'\u2713'}
      </SText>
    </View>
  );
}

function ErrorIcon() {
  const { colors } = useCommerceTheme();
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
  switch (status) {
    case 'loading':
      return <LoadingDots />;
    case 'success':
      return <SuccessIcon />;
    case 'error':
      return <ErrorIcon />;
    case 'idle':
    default:
      return null;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    loadingContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xxs,
      marginLeft: spacing.sm,
    },
    dot: {
      backgroundColor: colors.accent,
      borderRadius: DOT_SIZE / 2,
      height: DOT_SIZE,
      width: DOT_SIZE,
    },
    iconContainer: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      height: 24,
      justifyContent: 'center',
      marginLeft: spacing.sm,
      width: 24,
    },
    successContainer: {
      backgroundColor: colors.success,
    },
    errorContainer: {
      backgroundColor: colors.error,
    },
    iconText: {
      color: colors.inverse,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
    },
  });
}
