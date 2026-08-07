import Constants from "expo-constants";

export const DEFAULT_AUTH_REDIRECT_URL = "gongguwish-preview://auth/callback";
export const PRODUCTION_AUTH_REDIRECT_URL = "gongguwish://auth/callback";

const PRODUCTION_APPLICATION_ID = "com.gonggu.wish";

const ALLOWED_AUTH_REDIRECT_URLS = new Set([
  DEFAULT_AUTH_REDIRECT_URL,
  PRODUCTION_AUTH_REDIRECT_URL,
]);

type ExpoExtra = Record<string, unknown> | null | undefined;

export function resolveAuthRedirectUrl(
  extra: ExpoExtra,
  nativeApplicationId?: string | null,
): string {
  const configuredUrl =
    typeof extra?.authRedirectUrl === "string"
      ? extra.authRedirectUrl.trim()
      : "";
  if (!configuredUrl) {
    return nativeApplicationId?.trim() === PRODUCTION_APPLICATION_ID
      ? PRODUCTION_AUTH_REDIRECT_URL
      : DEFAULT_AUTH_REDIRECT_URL;
  }

  if (!ALLOWED_AUTH_REDIRECT_URLS.has(configuredUrl)) {
    throw new Error("Invalid auth redirect URL in Expo configuration");
  }
  return configuredUrl;
}

export const AUTH_REDIRECT_URL = resolveAuthRedirectUrl(
  Constants.expoConfig?.extra,
  Constants.expoConfig?.android?.package ??
    Constants.expoConfig?.ios?.bundleIdentifier,
);
