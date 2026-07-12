export function normalizePriceKrw(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed = typeof normalized === "number"
    ? normalized
    : typeof normalized === "string" && /^\d+$/.test(normalized)
      ? Number(normalized)
      : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {
    throw new Error("priceKrw must be a non-negative PostgreSQL INTEGER.");
  }

  return parsed;
}

export function normalizeHomeBannerBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("isHomeBanner must be a boolean.");
  }

  return value;
}

export function normalizeHomeBannerDate(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a real calendar date.`);
  }

  return normalized;
}

export function validateHomeBannerSchedule(schedule: {
  isHomeBanner: boolean;
  startDate: string | null;
  endDate: string | null;
}) {
  if (schedule.isHomeBanner && (!schedule.startDate || !schedule.endDate)) {
    throw new Error("Home banner start and end dates are required when enabled.");
  }
  if (schedule.startDate && schedule.endDate && schedule.startDate > schedule.endDate) {
    throw new Error("Home banner end date must be on or after its start date.");
  }
}

export type HomeBannerSchedule = {
  isHomeBanner: boolean;
  startDate: string | null;
  endDate: string | null;
};

export function mergeHomeBannerSchedule(
  patch: Partial<HomeBannerSchedule>,
  existing: HomeBannerSchedule,
): HomeBannerSchedule {
  const merged = { ...existing, ...patch };
  validateHomeBannerSchedule(merged);
  return merged;
}
