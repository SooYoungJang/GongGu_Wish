import { useEffect, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { useIsFocused } from "@react-navigation/native";

export function usePlaybackLifecycle() {
  const isScreenFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );
  const [isAppFocused, setIsAppFocused] = useState(true);

  useEffect(() => {
    const changeSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const isActive = nextState === "active";
        setIsAppActive(isActive);
        setIsAppFocused(isActive);
      },
    );
    const blurSubscription =
      Platform.OS === "android"
        ? AppState.addEventListener("blur", () => setIsAppFocused(false))
        : null;
    const focusSubscription =
      Platform.OS === "android"
        ? AppState.addEventListener("focus", () => setIsAppFocused(true))
        : null;

    return () => {
      changeSubscription.remove();
      blurSubscription?.remove();
      focusSubscription?.remove();
    };
  }, []);

  return {
    isScreenFocused,
    isAppActive,
    isAppFocused,
    // Android emits blur for transient system UI such as the share sheet while
    // AppState remains active. Only true screen/background loss gates playback.
    isPlaybackActive: isScreenFocused && isAppActive,
  };
}
