import { getAdsErrorCode, getAdsErrorReason } from "./adsDiagnostics";

export type NativeAdLoadAttemptFailure = {
  attempt: number;
  error: unknown;
  maxAttempts: number;
  retryDelayMs: number | null;
  willRetry: boolean;
};

export type NativeAdTestCreative = "image_app_install" | "video_app_install";

export function getNativeAdRecoveryTestCreative(
  error: unknown,
  isReel: boolean,
): NativeAdTestCreative | undefined {
  const code = getAdsErrorCode(error)
    .split("/")
    .pop()
    ?.replace(/^error-code-/, "");
  if (
    code !== "no-fill" &&
    getAdsErrorReason(error) !== "native-response-invalid"
  )
    return undefined;

  // ft_ctype only selects creatives for test requests; it does not enable test
  // mode or restrict paid inventory. Both values support native ads.
  // https://developers.google.com/admob/android/test-creative-types
  return isReel ? "video_app_install" : "image_app_install";
}

function getRetryDelayMs(attempt: number, error: unknown): number | null {
  const code = getAdsErrorCode(error)
    .split("/")
    .pop()
    ?.replace(/^error-code-/, "");
  if (code === "invalid-request" || code === "app-id-missing") return null;
  // Inventory changes and the SDK's JavaScript engine cold start can take
  // tens of seconds. Preserve the bounded retry budget until they can recover.
  const needsLongBackoff =
    code === "no-fill" ||
    getAdsErrorReason(error) === "javascript-engine-unavailable";
  const delays = needsLongBackoff ? [30_000, 60_000] : [1_000, 3_000];
  return delays[Math.min(attempt - 1, delays.length - 1)];
}

export class NativeAdLoadTimeoutError extends Error {
  readonly code = "request-timeout";

  constructor() {
    super("Native ad request timed out");
    this.name = "NativeAdLoadTimeoutError";
  }
}

function loadWithTimeout<T>({
  load,
  onLateSuccess,
  timeoutMs,
}: {
  load: () => Promise<T>;
  // eslint-disable-next-line no-unused-vars
  onLateSuccess?: (value: T) => void;
  timeoutMs?: number;
}) {
  const pending = Promise.resolve().then(load);
  if (!timeoutMs || timeoutMs <= 0) return pending;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new NativeAdLoadTimeoutError());
    }, timeoutMs);

    void pending.then(
      (value) => {
        if (settled) {
          onLateSuccess?.(value);
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function loadNativeAdWithRetry<T>({
  load,
  maxAttempts = 3,
  onAttemptFailure,
  onLateSuccess,
  shouldRetry,
  timeoutMs,
  waitForRetry,
}: {
  load: () => Promise<T>;
  maxAttempts?: number;
  // eslint-disable-next-line no-unused-vars
  onAttemptFailure?: (failure: NativeAdLoadAttemptFailure) => void;
  // eslint-disable-next-line no-unused-vars
  onLateSuccess?: (value: T) => void;
  shouldRetry?: () => boolean;
  timeoutMs?: number;
  // eslint-disable-next-line no-unused-vars
  waitForRetry: (delayMs: number) => Promise<void>;
}): Promise<T> {
  let lastError: unknown;
  const attemptLimit = Number.isFinite(maxAttempts)
    ? Math.max(1, Math.trunc(maxAttempts))
    : 1;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    try {
      return await loadWithTimeout({ load, onLateSuccess, timeoutMs });
    } catch (error) {
      lastError = error;
      const retryDelayMs = getRetryDelayMs(attempt, error);
      // The native request cannot be cancelled. Retrying after our watchdog
      // fires would leave the timed-out request in flight and overlap it with
      // a second request.
      const willRetry =
        !(error instanceof NativeAdLoadTimeoutError) &&
        retryDelayMs !== null &&
        attempt < attemptLimit &&
        shouldRetry?.() !== false;
      onAttemptFailure?.({
        attempt,
        error,
        maxAttempts: attemptLimit,
        retryDelayMs: willRetry ? retryDelayMs : null,
        willRetry,
      });
      if (!willRetry || retryDelayMs === null) break;
      await waitForRetry(retryDelayMs);
      if (shouldRetry?.() === false) break;
    }
  }

  throw lastError;
}
