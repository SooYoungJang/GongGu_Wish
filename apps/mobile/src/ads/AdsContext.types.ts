export type AdsContextValue = {
  enabled: boolean;
  isReady: boolean;
  isSettled: boolean;
  homeNativeUnitId: string | null;
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<boolean>;
};
