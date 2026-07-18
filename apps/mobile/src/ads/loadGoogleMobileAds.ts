import Constants from "expo-constants";

export type GoogleMobileAdsModule =
  typeof import("react-native-google-mobile-ads");

export function createGoogleMobileAdsModuleLoader<T>({
  importModule,
  isExpoGo,
}: {
  importModule: () => Promise<T>;
  isExpoGo: boolean;
}): () => Promise<T | null> {
  let modulePromise: Promise<T | null> | null = null;

  return () => {
    if (isExpoGo) return Promise.resolve(null);
    modulePromise ??= importModule().catch(() => null);
    return modulePromise;
  };
}

export const getGoogleMobileAdsModule =
  createGoogleMobileAdsModuleLoader<GoogleMobileAdsModule>({
    importModule: () => import("react-native-google-mobile-ads"),
    isExpoGo: Constants.appOwnership === "expo",
  });
