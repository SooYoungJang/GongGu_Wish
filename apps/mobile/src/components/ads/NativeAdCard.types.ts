import type { Dispatch } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { NativeAdPlacement } from "../../ads/adConfig";

export type NativeAdLoadStatus = "loading" | "loaded" | "unavailable";

export type NativeAdCardProps = {
  loadEnabled?: boolean;
  onLoadStateChange?: Dispatch<NativeAdLoadStatus>;
  placement?: NativeAdPlacement;
  reelBottomInset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: "card" | "reel" | "row" | "tile";
  visible?: boolean;
};
