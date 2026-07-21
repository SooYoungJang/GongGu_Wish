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
import { Platform } from "react-native";

import {
  type AdsMode,
  type NativeAdUnitIds,
  resolveAdsRuntimeConfig,
} from "./adConfig";
import {
  createGoogleMobileAdsController,
  type AdsInitializationState,
  type GoogleMobileAdsController,
} from "./initializeMobileAds";
import type { AdsContextValue } from "./AdsContext.types";
import { getGoogleMobileAdsModule } from "./loadGoogleMobileAds";

export type { AdsContextValue } from "./AdsContext.types";

// Official platform-specific demo IDs keep Preview traffic out of reports.
// https://developers.google.com/admob/android/test-ads
// https://developers.google.com/admob/ios/test-ads
const TEST_CONFIG = {
  android: {
    appId: "ca-app-pub-3940256099942544~3347511713",
    nativeUnitIds: {
      detail: "ca-app-pub-3940256099942544/2247696110",
      home: "ca-app-pub-3940256099942544/2247696110",
      reels: "ca-app-pub-3940256099942544/1044960115",
    },
  },
  ios: {
    appId: "ca-app-pub-3940256099942544~1458002511",
    nativeUnitIds: {
      detail: "ca-app-pub-3940256099942544/3986624511",
      home: "ca-app-pub-3940256099942544/3986624511",
      reels: "ca-app-pub-3940256099942544/2521693316",
    },
  },
} satisfies Record<
  "android" | "ios",
  { appId: string; nativeUnitIds: NativeAdUnitIds }
>;

type AdsExtra = {
  automatedE2E?: boolean;
  adsMode?: string;
  admobAndroidAppId?: string | null;
  admobIosAppId?: string | null;
  admobAndroidNativeUnitIds?: Partial<NativeAdUnitIds>;
  admobIosNativeUnitIds?: Partial<NativeAdUnitIds>;
};

type AdsProviderProps = PropsWithChildren<{
  adAccessResolved?: boolean;
  adsRemoved?: boolean;
}>;

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
  nativeUnitIds: { detail: null, home: null, reels: null },
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

export function AdsProvider({
  adAccessResolved = true,
  adsRemoved = false,
  children,
}: AdsProviderProps) {
  const extra = (Constants.expoConfig?.extra ?? {}) as AdsExtra;
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const testConfig = TEST_CONFIG[platform];
  const config = useMemo(
    () =>
      resolveAdsRuntimeConfig({
        platform,
        adAccessResolved,
        adsRemoved,
        automatedE2E: extra.automatedE2E === true,
        mode: normalizeAdsMode(extra.adsMode),
        appId:
          platform === "ios"
            ? (extra.admobIosAppId ?? undefined)
            : (extra.admobAndroidAppId ?? undefined),
        productionNativeUnitIds:
          platform === "ios"
            ? (extra.admobIosNativeUnitIds ?? {})
            : (extra.admobAndroidNativeUnitIds ?? {}),
        testAppId: testConfig.appId,
        testNativeUnitIds: testConfig.nativeUnitIds,
      }),
    [
      adAccessResolved,
      adsRemoved,
      extra.admobAndroidAppId,
      extra.admobAndroidNativeUnitIds,
      extra.admobIosAppId,
      extra.admobIosNativeUnitIds,
      extra.adsMode,
      extra.automatedE2E,
      platform,
      testConfig,
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
          : { isReady: false, privacyOptionsRequired: false },
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
