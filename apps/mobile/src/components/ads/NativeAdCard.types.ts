import type { Dispatch } from "react";

export type NativeAdLoadStatus = "loading" | "loaded" | "unavailable";

export type NativeAdCardProps = {
  onLoadStateChange?: Dispatch<NativeAdLoadStatus>;
  testID?: string;
};
