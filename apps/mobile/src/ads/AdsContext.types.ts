import type { ResolvedNativeAdUnitIds } from "./adConfig";

export type AdsContextValue = {
  enabled: boolean;
  isReady: boolean;
  isSettled: boolean;
  nativeUnitIds: ResolvedNativeAdUnitIds;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<boolean>;
};
