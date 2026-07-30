export type AppInfo = {
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  version: string;
};

export const DEFAULT_PRIVACY_POLICY_URL =
  "https://gongguwish.com/privacy";
export const DEFAULT_TERMS_OF_SERVICE_URL =
  "https://gongguwish.com/terms";

type ResolveAppInfoInput = {
  nativeApplicationVersion?: unknown;
  nativeBuildVersion?: unknown;
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

function nativeVersionLabel(version: unknown, build: unknown): string | null {
  const appVersion = nonBlankString(version);
  if (!appVersion) return null;

  const buildVersion = nonBlankString(build);
  return buildVersion ? `${appVersion} (${buildVersion})` : appVersion;
}

export function resolveAppInfo({
  nativeApplicationVersion,
  nativeBuildVersion,
  configuredVersion,
  fallbackVersion,
  privacyPolicyUrl,
  termsOfServiceUrl,
}: ResolveAppInfoInput): AppInfo {
  return {
    privacyPolicyUrl: optionalHttpsUrl(privacyPolicyUrl),
    termsOfServiceUrl: optionalHttpsUrl(termsOfServiceUrl),
    version:
      nativeVersionLabel(nativeApplicationVersion, nativeBuildVersion) ??
      nonBlankString(configuredVersion) ??
      nonBlankString(fallbackVersion) ??
      "알 수 없음",
  };
}
