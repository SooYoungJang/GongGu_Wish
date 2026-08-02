import { trustedInstagramCdnUrl } from "../_shared/hiker-instagram-audio.ts";

export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  return normalized !== "unknown" && /^[a-z0-9._]{1,30}$/.test(normalized)
    ? normalized
    : null;
}

export function parseInstagramUsernameWrite(value: unknown): string | null {
  const normalized = normalizeInstagramUsername(value);
  if (normalized) return normalized;
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" &&
      (!value.trim().replace(/^@+/, "") ||
        value.trim().replace(/^@+/, "").toLowerCase() === "unknown"))
  ) {
    return null;
  }
  throw new Error("instagramUsername must be a valid Instagram handle");
}

export function hasInstagramOwnerChanged(
  previousUsername: unknown,
  nextUsername: unknown,
): boolean {
  return (
    normalizeInstagramUsername(nextUsername) !==
    normalizeInstagramUsername(previousUsername)
  );
}

export function normalizeProfileImageUrl(value: unknown): string | null {
  return trustedInstagramCdnUrl(value);
}

export type ProfileImageWriteIntent = {
  shouldUpdate: boolean;
  profileImageUrl: string | null;
};

export function parseProfileImageWriteIntent(
  value: unknown,
  touched: boolean,
): ProfileImageWriteIntent {
  if (!touched) return { shouldUpdate: false, profileImageUrl: null };
  if (value === null || value === undefined) {
    return { shouldUpdate: true, profileImageUrl: null };
  }
  if (typeof value === "string" && !value.trim()) {
    return { shouldUpdate: true, profileImageUrl: null };
  }

  const profileImageUrl = normalizeProfileImageUrl(value);
  if (!profileImageUrl) {
    throw new Error("profileImageUrl must be a trusted Instagram CDN URL");
  }
  return { shouldUpdate: true, profileImageUrl };
}

export function resolveCanonicalProfileImageWriteIntent(
  value: unknown,
  touched: boolean,
  ownerChanged: boolean,
): ProfileImageWriteIntent {
  const intent = parseProfileImageWriteIntent(value, touched);
  if (ownerChanged && intent.shouldUpdate && intent.profileImageUrl === null) {
    return { shouldUpdate: false, profileImageUrl: null };
  }
  return intent;
}
