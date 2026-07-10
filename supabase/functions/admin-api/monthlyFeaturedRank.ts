export function normalizeMonthlyFeaturedRank(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.trim())
      : null;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("monthlyFeaturedRank must be a positive integer.");
  }

  return parsed;
}
