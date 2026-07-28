export type ConsentInfo = {
  canRequestAds: boolean;
  privacyOptionsRequirementStatus?: string;
};

export type AdsInitializationState = {
  isReady: boolean;
  privacyOptionsRequired: boolean;
};

export type GoogleMobileAdsDependencies = {
  gatherConsent: () => Promise<unknown>;
  getConsentInfo: () => Promise<ConsentInfo>;
  showPrivacyOptionsForm: () => Promise<ConsentInfo>;
  initialize: () => Promise<unknown>;
};

export type GoogleMobileAdsController = {
  initialize: () => Promise<AdsInitializationState>;
  showPrivacyOptions: () => Promise<AdsInitializationState>;
};

const disabledState: AdsInitializationState = {
  isReady: false,
  privacyOptionsRequired: false,
};

function isConsentInfo(value: unknown): value is ConsentInfo {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsentInfo>;
  return (
    typeof candidate.canRequestAds === "boolean" &&
    (candidate.privacyOptionsRequirementStatus === "REQUIRED" ||
      candidate.privacyOptionsRequirementStatus === "NOT_REQUIRED")
  );
}

export function createGoogleMobileAdsController(
  dependencies: GoogleMobileAdsDependencies,
): GoogleMobileAdsController {
  let sdkInitialized = false;
  let sdkInitialization: Promise<void> | null = null;
  let startupInitialization: Promise<AdsInitializationState> | null = null;

  const ensureSdkInitialized = async () => {
    if (sdkInitialized) return;
    sdkInitialization ??= Promise.resolve(dependencies.initialize())
      .then(() => {
        sdkInitialized = true;
      })
      .finally(() => {
        sdkInitialization = null;
      });
    await sdkInitialization;
  };

  const applyConsentInfo = async (
    consentInfo: ConsentInfo,
  ): Promise<AdsInitializationState> => {
    const privacyOptionsRequired =
      consentInfo.privacyOptionsRequirementStatus === "REQUIRED";
    if (!consentInfo.canRequestAds) {
      return { isReady: false, privacyOptionsRequired };
    }

    await ensureSdkInitialized();
    return { isReady: true, privacyOptionsRequired };
  };

  const initialize = () => {
    if (startupInitialization) return startupInitialization;

    startupInitialization = (async () => {
      let refreshedConsentInfo: unknown;
      try {
        refreshedConsentInfo = await dependencies.gatherConsent();
      } catch {
        // UMP can still expose a valid consent state from the prior session.
      }

      if (isConsentInfo(refreshedConsentInfo)) {
        return applyConsentInfo(refreshedConsentInfo);
      }

      let consentInfo: ConsentInfo;
      try {
        consentInfo = await dependencies.getConsentInfo();
      } catch {
        return disabledState;
      }

      return applyConsentInfo(consentInfo);
    })().finally(() => {
      startupInitialization = null;
    });

    return startupInitialization;
  };

  const showPrivacyOptions = async () =>
    applyConsentInfo(await dependencies.showPrivacyOptionsForm());

  return { initialize, showPrivacyOptions };
}
