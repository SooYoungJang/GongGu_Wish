import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

export type MainTabsBackDecision = {
  action: "navigate-home" | "show-exit-hint" | "exit-app";
  nextHomeBackPressAt: number;
};

export function decideMainTabsBack(
  activeTab: string,
  lastHomeBackPressAt: number,
  now: number,
  exitWindowMs: number,
): MainTabsBackDecision {
  if (activeTab !== "Home") {
    return { action: "navigate-home", nextHomeBackPressAt: 0 };
  }

  if (lastHomeBackPressAt > 0 && now - lastHomeBackPressAt <= exitWindowMs) {
    return { action: "exit-app", nextHomeBackPressAt: lastHomeBackPressAt };
  }

  return { action: "show-exit-hint", nextHomeBackPressAt: now };
}

export function useFocusedAndroidBackHandler(
  onBack: () => boolean,
  enabled = Platform.OS === "android",
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useFocusEffect(
    useCallback(() => {
      if (!enabled || Platform.OS !== "android") return undefined;

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => onBackRef.current(),
      );
      return () => subscription.remove();
    }, [enabled]),
  );
}
