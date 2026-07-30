type AuthUserIdentity = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type AuthUserPresentation = {
  avatarInitial: string;
  label: string;
};

const SOCIAL_NAME_KEYS = [
  'nickname',
  'name',
  'full_name',
  'preferred_username',
] as const;

function nonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAuthUserPresentation(
  user: AuthUserIdentity,
): AuthUserPresentation {
  const metadata = user.user_metadata ?? {};
  const label =
    nonBlankString(user.email) ??
    SOCIAL_NAME_KEYS.map((key) => nonBlankString(metadata[key])).find(
      (candidate): candidate is string => candidate !== null,
    ) ??
    '사용자';

  return {
    avatarInitial: Array.from(label)[0]?.toUpperCase() ?? '?',
    label,
  };
}
