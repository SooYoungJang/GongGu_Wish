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
  return undefined;
}

export function emitAdsDiagnostic(
  event: AdsDiagnosticEvent,
  write: AdsDiagnosticWriter = console.info,
) {
  write(JSON.stringify({ scope: "mobile_ads", ...event }));
}
