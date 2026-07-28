export type NativeAdLoadAttemptFailure = {
  attempt: number;
  error: unknown;
  maxAttempts: number;
};

export async function loadNativeAdWithRetry<T>({
  load,
  maxAttempts = 3,
  onAttemptFailure,
  waitForRetry,
}: {
  load: () => Promise<T>;
  maxAttempts?: number;
  // eslint-disable-next-line no-unused-vars
  onAttemptFailure?: (failure: NativeAdLoadAttemptFailure) => void;
  // eslint-disable-next-line no-unused-vars
  waitForRetry: (attempt: number) => Promise<void>;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      lastError = error;
      onAttemptFailure?.({ attempt, error, maxAttempts });
      if (attempt < maxAttempts) await waitForRetry(attempt);
    }
  }

  throw lastError;
}
