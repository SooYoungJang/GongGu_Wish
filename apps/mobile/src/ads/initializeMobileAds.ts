export type ConsentInfo = {
  canRequestAds: boolean;
};

export type GoogleMobileAdsDependencies = {
  gatherConsent: () => Promise<unknown>;
  getConsentInfo: () => Promise<ConsentInfo>;
  initialize: () => Promise<unknown>;
};

export async function initializeGoogleMobileAds(
  dependencies: GoogleMobileAdsDependencies,
): Promise<boolean> {
  try {
    await dependencies.gatherConsent();
  } catch {
    // UMP can still use a valid consent state from the previous session.
  }

  let consentInfo: ConsentInfo;
  try {
    consentInfo = await dependencies.getConsentInfo();
  } catch {
    return false;
  }

  if (!consentInfo.canRequestAds) {
    return false;
  }

  await dependencies.initialize();
  return true;
}

export function createGoogleMobileAdsInitializer(
  dependencies: GoogleMobileAdsDependencies,
): () => Promise<boolean> {
  let initialization: Promise<boolean> | null = null;

  return () => {
    initialization ??= initializeGoogleMobileAds(dependencies);
    return initialization;
  };
}
