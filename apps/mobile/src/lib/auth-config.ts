import Constants from "expo-constants";

export const DEFAULT_AUTH_REDIRECT_URL = "gongguwish-preview://auth/callback";

const ALLOWED_AUTH_REDIRECT_URLS = new Set([
  DEFAULT_AUTH_REDIRECT_URL,
  "gongguwish://auth/callback",
]);

type ExpoExtra = Record<string, unknown> | null | undefined;

export function resolveAuthRedirectUrl(extra: ExpoExtra): string {
  const configuredUrl =
    typeof extra?.authRedirectUrl === "string"
      ? extra.authRedirectUrl.trim()
      : "";
  if (!configuredUrl) return DEFAULT_AUTH_REDIRECT_URL;

  if (!ALLOWED_AUTH_REDIRECT_URLS.has(configuredUrl)) {
    throw new Error("Invalid auth redirect URL in Expo configuration");
  }
  return configuredUrl;
}

export const AUTH_REDIRECT_URL = resolveAuthRedirectUrl(
  Constants.expoConfig?.extra,
);
