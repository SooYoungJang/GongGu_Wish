import { createContext, type PropsWithChildren, useContext } from "react";

import type { AdsContextValue } from "./AdsContext.types";

export type { AdsContextValue } from "./AdsContext.types";

const showNoPrivacyOptions = async () => false;

export const disabledAds: AdsContextValue = {
  enabled: false,
  isReady: false,
  isSettled: true,
  nativeUnitIds: { detail: null, home: null, reels: null },
  privacyOptionsRequired: false,
  showPrivacyOptions: showNoPrivacyOptions,
};

export const AdsContext = createContext<AdsContextValue>(disabledAds);

export function AdsProvider({
  children,
}: PropsWithChildren<{
  adAccessResolved?: boolean;
  adsRemoved?: boolean;
}>) {
  return (
    <AdsContext.Provider value={disabledAds}>{children}</AdsContext.Provider>
  );
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
