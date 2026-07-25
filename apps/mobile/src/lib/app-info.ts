export type AppInfo = {
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  version: string;
};

export const DEFAULT_PRIVACY_POLICY_URL =
  "https://separate-bank-636.notion.site/3a88f7ccc9f180768dbcdd7871d4aaab";
export const DEFAULT_TERMS_OF_SERVICE_URL =
  "https://separate-bank-636.notion.site/3a78f7ccc9f180469a4acff0c62efce7";

type ResolveAppInfoInput = {
  configuredVersion?: unknown;
  fallbackVersion?: unknown;
  privacyPolicyUrl?: unknown;
  termsOfServiceUrl?: unknown;
};

function nonBlankString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalHttpsUrl(value: unknown): string | null {
  const normalized = nonBlankString(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function resolveAppInfo({
  configuredVersion,
  fallbackVersion,
  privacyPolicyUrl,
  termsOfServiceUrl,
}: ResolveAppInfoInput): AppInfo {
  return {
    privacyPolicyUrl: optionalHttpsUrl(privacyPolicyUrl),
    termsOfServiceUrl: optionalHttpsUrl(termsOfServiceUrl),
    version:
      nonBlankString(configuredVersion) ??
      nonBlankString(fallbackVersion) ??
      "알 수 없음",
  };
}
