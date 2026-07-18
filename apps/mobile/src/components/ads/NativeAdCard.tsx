import { memo, useEffect } from "react";

import type { NativeAdCardProps } from "./NativeAdCard.types";

export type {
  NativeAdCardProps,
  NativeAdLoadStatus,
} from "./NativeAdCard.types";

export const NativeAdCard = memo(function NativeAdCard({
  onLoadStateChange,
}: NativeAdCardProps) {
  useEffect(() => {
    onLoadStateChange?.("unavailable");
  }, [onLoadStateChange]);

  return null;
});
