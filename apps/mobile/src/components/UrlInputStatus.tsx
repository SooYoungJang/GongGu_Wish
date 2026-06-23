import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, colors, spacing } from '../design/tokens';

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
    <View style={styles.loadingContainer}>
      {opacities.map((opacity, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: opacity as unknown as number }]}
        />
      ))}
    </View>
  );
}

// ─── Status Icon ─────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <View style={[styles.iconContainer, styles.successContainer]}>
      <SText variant="caption" style={styles.iconText}>
        {'\u2713'}
      </SText>
    </View>
  );
}

function ErrorIcon() {
  return (
    <View style={[styles.iconContainer, styles.errorContainer]}>
      <SText variant="caption" style={styles.iconText}>
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.ctaPurple,
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
    backgroundColor: colors.ctaPurple,
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
