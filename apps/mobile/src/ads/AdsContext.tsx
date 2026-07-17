import Constants from "expo-constants";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import mobileAds, {
  AdsConsent,
  TestIds,
} from "react-native-google-mobile-ads";

import { resolveAdsRuntimeConfig } from "./adConfig";
import { createGoogleMobileAdsInitializer } from "./initializeMobileAds";

type AdsContextValue = {
  enabled: boolean;
  isReady: boolean;
  homeNativeUnitId: string | null;
};

type AdsExtra = {
  automatedE2E?: boolean;
  adsEnabled?: boolean;
  admobHomeNativeUnitId?: string | null;
};

const disabledAds: AdsContextValue = {
  enabled: false,
  isReady: false,
  homeNativeUnitId: null,
};

export const AdsContext = createContext<AdsContextValue>(disabledAds);

const initializeGoogleMobileAdsOnce = createGoogleMobileAdsInitializer({
  gatherConsent: () => AdsConsent.gatherConsent(),
  getConsentInfo: () => AdsConsent.getConsentInfo(),
  initialize: () => mobileAds().initialize(),
});

export function AdsProvider({ children }: PropsWithChildren) {
  const extra = (Constants.expoConfig?.extra ?? {}) as AdsExtra;
  const config = useMemo(
    () =>
      resolveAdsRuntimeConfig({
        platform: Platform.OS,
        isDev: __DEV__,
        automatedE2E: extra.automatedE2E === true,
        productionEnabled: extra.adsEnabled === true,
        productionHomeNativeUnitId: extra.admobHomeNativeUnitId ?? undefined,
        testNativeUnitId: TestIds.NATIVE,
      }),
    [extra.admobHomeNativeUnitId, extra.adsEnabled, extra.automatedE2E],
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!config.enabled) {
      setIsReady(false);
      return;
    }

    let mounted = true;
    void initializeGoogleMobileAdsOnce()
      .then((ready) => {
        if (mounted) setIsReady(ready);
      })
      .catch(() => {
        if (mounted) setIsReady(false);
      });

    return () => {
      mounted = false;
    };
  }, [config.enabled]);

  const value = useMemo<AdsContextValue>(
    () => ({ ...config, isReady: config.enabled && isReady }),
    [config, isReady],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
