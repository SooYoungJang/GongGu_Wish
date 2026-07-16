import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Keeps unattended motion off while preferences are unknown and whenever a
 * screen reader or the platform Reduce Motion setting is active.
 *
 * @see https://reactnative.dev/docs/0.83/accessibilityinfo
 */
export function useAccessibilityAutoPlayPause() {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<
    boolean | null
  >(null);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotionEnabled((current) => current ?? enabled);
        }
      })
      .catch(() => {
        // Unknown preferences deliberately keep autoplay paused.
      });
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (mounted) {
          setScreenReaderEnabled((current) => current ?? enabled);
        }
      })
      .catch(() => {
        // Unknown preferences deliberately keep autoplay paused.
      });

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );
    const screenReaderSubscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled,
    );

    return () => {
      mounted = false;
      reduceMotionSubscription.remove();
      screenReaderSubscription.remove();
    };
  }, []);

  return (
    reduceMotionEnabled !== false ||
    screenReaderEnabled !== false
  );
}
