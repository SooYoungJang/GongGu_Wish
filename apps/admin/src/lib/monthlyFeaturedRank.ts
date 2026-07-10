export function normalizeMonthlyFeaturedRankInput(value: string): string | null {
  if (value === "") return value;
  if (!/^[1-9]\d*$/.test(value)) return null;

  return Number.isSafeInteger(Number(value)) ? value : null;
}

export function parseMonthlyFeaturedRank(value: string): number | null {
  const normalized = normalizeMonthlyFeaturedRankInput(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function monthlyFeaturedRankInputValue(value: number | null | undefined): string {
  return value != null && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}
