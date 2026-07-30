export type NativeAdLoadAttemptFailure = {
  attempt: number;
  error: unknown;
  maxAttempts: number;
  willRetry: boolean;
};

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
  waitForRetry: (attempt: number) => Promise<void>;
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
      // The native request cannot be cancelled. Retrying after our watchdog
      // fires would leave the timed-out request in flight and overlap it with
      // a second request.
      const willRetry =
        !(error instanceof NativeAdLoadTimeoutError) &&
        attempt < attemptLimit &&
        shouldRetry?.() !== false;
      onAttemptFailure?.({
        attempt,
        error,
        maxAttempts: attemptLimit,
        willRetry,
      });
      if (!willRetry) break;
      await waitForRetry(attempt);
      if (shouldRetry?.() === false) break;
    }
  }

  throw lastError;
}
