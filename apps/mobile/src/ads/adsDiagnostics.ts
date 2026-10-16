type AdsDiagnosticValue = boolean | number | string | null | undefined;

export type AdsDiagnosticEvent = {
  event: string;
  [key: string]: AdsDiagnosticValue;
};

type AdsDiagnosticWriter = typeof console.info;

export function getAdsErrorCode(error: unknown): string {
  const rawCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : error instanceof Error
        ? error.name
        : undefined;
  if (typeof rawCode !== "string") return "unknown";

  const normalized = rawCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || "unknown";
}

export function getAdsErrorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error)) return;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return;
  // Classify stock SDK hints only. Never log arbitrary messages, request URLs,
  // ad-unit/device identifiers, credentials, or response payloads.
  const hint = message.slice(0, 1_000).toLowerCase();
  if (hint.includes("no ad config")) return "no-ad-config";
  if (hint.includes("unable to obtain a javascriptengine")) {
    return "javascript-engine-unavailable";
  }
  if (hint.includes("error building request url")) return "request-url-error";
  if (hint.includes("failed to instantiate ad adapter")) {
    return "adapter-instantiation-failed";
  }
  if (hint.includes("retrieve required value in native ad response failed")) {
    return "native-response-invalid";
  }
  return undefined;
}

export function getAdsNativeErrorMetadata(error: unknown): {
  nativeErrorCode?: number;
  nativeSdkVersion?: string;
} {
  if (!error || typeof error !== "object" || !("userInfo" in error)) return {};
  const userInfo = (error as { userInfo?: unknown }).userInfo;
  if (!userInfo || typeof userInfo !== "object") return {};
  const { nativeErrorCode, googleMobileAdsVersion } = userInfo as {
    nativeErrorCode?: unknown;
    googleMobileAdsVersion?: unknown;
  };

  return {
    ...(typeof nativeErrorCode === "number" &&
    Number.isInteger(nativeErrorCode) &&
    nativeErrorCode >= 0 &&
    nativeErrorCode <= 1_000
      ? { nativeErrorCode }
      : {}),
    ...(typeof googleMobileAdsVersion === "string" &&
    /^\d{1,2}\.\d{1,2}\.\d{1,3}$/.test(googleMobileAdsVersion) &&
    googleMobileAdsVersion.trim() === googleMobileAdsVersion
      ? { nativeSdkVersion: googleMobileAdsVersion }
      : {}),
  };
}

export function emitAdsDiagnostic(
  event: AdsDiagnosticEvent,
  write: AdsDiagnosticWriter = console.info,
) {
  write(JSON.stringify({ scope: "mobile_ads", ...event }));
}
