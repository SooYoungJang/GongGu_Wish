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

export function emitAdsDiagnostic(
  event: AdsDiagnosticEvent,
  write: AdsDiagnosticWriter = console.info,
) {
  write(JSON.stringify({ scope: "mobile_ads", ...event }));
}
