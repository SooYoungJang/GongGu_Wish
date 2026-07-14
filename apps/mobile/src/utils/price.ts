export function normalizePriceKrw(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed =
    typeof normalized === "number"
      ? normalized
      : typeof normalized === "string" && /^\d+$/.test(normalized)
        ? Number(normalized)
        : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2_147_483_647
    ? parsed
    : null;
}

export function formatPriceKrw(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
