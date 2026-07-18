import Constants from "expo-constants";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { type AdsMode, resolveAdsRuntimeConfig } from "./adConfig";
import {
  createGoogleMobileAdsController,
  type AdsInitializationState,
  type GoogleMobileAdsController,
} from "./initializeMobileAds";
import type { AdsContextValue } from "./AdsContext.types";
import { getGoogleMobileAdsModule } from "./loadGoogleMobileAds";

export type { AdsContextValue } from "./AdsContext.types";

const GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID =
  "ca-app-pub-3940256099942544~3347511713";
const GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID =
  "ca-app-pub-3940256099942544/2247696110";

type AdsExtra = {
  automatedE2E?: boolean;
  adsMode?: string;
  admobAndroidAppId?: string | null;
  admobHomeNativeUnitId?: string | null;
};

const initialState: AdsInitializationState & { isSettled: boolean } = {
  isReady: false,
  isSettled: false,
  privacyOptionsRequired: false,
};
const showNoPrivacyOptions = async () => false;
const disabledAds: AdsContextValue = {
  enabled: false,
  isReady: false,
  isSettled: true,
  homeNativeUnitId: null,
  privacyOptionsRequired: false,
  showPrivacyOptions: showNoPrivacyOptions,
};

function normalizeAdsMode(mode?: string): AdsMode {
  return mode === "test" || mode === "production" ? mode : "off";
}

export const AdsContext = createContext<AdsContextValue>(disabledAds);

let adsControllerPromise: Promise<GoogleMobileAdsController | null> | null =
  null;

function getAdsController(): Promise<GoogleMobileAdsController | null> {
  adsControllerPromise ??= getGoogleMobileAdsModule().then((module) => {
    if (!module) return null;
    return createGoogleMobileAdsController({
      gatherConsent: () => module.AdsConsent.gatherConsent(),
      getConsentInfo: () => module.AdsConsent.getConsentInfo(),
      showPrivacyOptionsForm: () => module.AdsConsent.showPrivacyOptionsForm(),
      initialize: () => module.default().initialize(),
    });
  });
  return adsControllerPromise;
}

export function AdsProvider({ children }: PropsWithChildren) {
  const extra = (Constants.expoConfig?.extra ?? {}) as AdsExtra;
  const config = useMemo(
    () =>
      resolveAdsRuntimeConfig({
        platform: "android",
        automatedE2E: extra.automatedE2E === true,
        mode: normalizeAdsMode(extra.adsMode),
        androidAppId: extra.admobAndroidAppId ?? undefined,
        productionHomeNativeUnitId: extra.admobHomeNativeUnitId ?? undefined,
        testAndroidAppId: GOOGLE_MOBILE_ADS_TEST_ANDROID_APP_ID,
        testNativeUnitId: GOOGLE_MOBILE_ADS_TEST_NATIVE_UNIT_ID,
      }),
    [
      extra.admobAndroidAppId,
      extra.admobHomeNativeUnitId,
      extra.adsMode,
      extra.automatedE2E,
    ],
  );
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!config.enabled) {
      setState({
        isReady: false,
        isSettled: true,
        privacyOptionsRequired: false,
      });
      return;
    }

    let mounted = true;
    setState((current) => ({ ...current, isReady: false, isSettled: false }));
    void getAdsController()
      .then((controller) =>
        controller
          ? controller.initialize()
          : {
              isReady: false,
              privacyOptionsRequired: false,
            },
      )
      .then((nextState) => {
        if (mounted) setState({ ...nextState, isSettled: true });
      })
      .catch(() => {
        if (mounted) {
          setState({
            isReady: false,
            isSettled: true,
            privacyOptionsRequired: false,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [config.enabled]);

  const showPrivacyOptions = useCallback(async () => {
    if (!config.enabled) return false;
    try {
      const controller = await getAdsController();
      if (!controller) return false;
      const nextState = await controller.showPrivacyOptions();
      setState({ ...nextState, isSettled: true });
      return true;
    } catch {
      return false;
    }
  }, [config.enabled]);

  const value = useMemo<AdsContextValue>(
    () => ({
      ...config,
      isReady: config.enabled && state.isReady,
      isSettled: state.isSettled,
      privacyOptionsRequired: state.privacyOptionsRequired,
      showPrivacyOptions,
    }),
    [config, showPrivacyOptions, state],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}
