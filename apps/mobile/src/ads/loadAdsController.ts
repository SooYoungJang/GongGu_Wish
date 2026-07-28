import type {
  AdsInitializationState,
  GoogleMobileAdsController,
} from "./initializeMobileAds";

const unavailableState: AdsInitializationState = {
  isReady: false,
  privacyOptionsRequired: false,
};

export function createAdsControllerLoader({
  loadController,
}: {
  loadController(): Promise<GoogleMobileAdsController | null>;
}): () => Promise<GoogleMobileAdsController | null> {
  let controllerPromise: Promise<GoogleMobileAdsController | null> | null =
    null;

  return () => {
    controllerPromise ??= Promise.resolve()
      .then(loadController)
      .then((controller) => {
        if (!controller) {
          controllerPromise = null;
        }
        return controller;
      })
      .catch((error: unknown) => {
        controllerPromise = null;
        throw error;
      });
    return controllerPromise;
  };
}

export async function initializeAdsWithRetry({
  loadController,
  waitForRetry,
}: {
  loadController: () => Promise<GoogleMobileAdsController | null>;
  waitForRetry: () => Promise<void>;
}): Promise<AdsInitializationState> {
  let controller: GoogleMobileAdsController | null = null;

  try {
    controller = await loadController();
  } catch {
    // Retry one transient native bridge or controller creation failure.
  }

  if (!controller) {
    await waitForRetry();
    try {
      controller = await loadController();
    } catch {
      return unavailableState;
    }
  }

  if (!controller) return unavailableState;

  try {
    return await controller.initialize();
  } catch {
    await waitForRetry();
    return controller.initialize();
  }
}
