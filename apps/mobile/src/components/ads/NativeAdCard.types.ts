import type { Dispatch } from "react";
import type { NativeAdPlacement } from "../../ads/adConfig";

export type NativeAdLoadStatus = "loading" | "loaded" | "unavailable";

export type NativeAdCardProps = {
  loadEnabled?: boolean;
  onLoadStateChange?: Dispatch<NativeAdLoadStatus>;
  placement?: NativeAdPlacement;
  testID?: string;
  variant?: "card" | "reel";
  visible?: boolean;
};
