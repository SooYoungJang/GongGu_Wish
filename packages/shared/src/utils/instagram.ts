export function normalizeOptionalInstagramUsername(
  value: string | null | undefined,
): string | null {
  const normalized =
    value
      ?.trim()
      .replace(/^@+\s*/, "")
      .trim() ?? "";

  if (!normalized || normalized.toLocaleLowerCase("en-US") === "unknown") {
    return null;
  }

  return normalized;
}

export function formatInstagramHandle(
  value: string | null | undefined,
): string | null {
  const username = normalizeOptionalInstagramUsername(value);
  return username ? `@${username}` : null;
}
