export const MAX_PRICE_KRW = 2_147_483_647;

export function parsePriceKrwInput(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;

  if (!/^\d+$/.test(normalized)) {
    throw new Error("가격은 원 단위 정수로 입력해주세요.");
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_PRICE_KRW) {
    throw new Error(
      `가격은 0원부터 ${MAX_PRICE_KRW.toLocaleString("ko-KR")}원까지 입력해주세요.`,
    );
  }

  return parsed;
}

/** Normalize API responses before a price reaches an input or preview. */
export function normalizePriceKrwValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  try {
    return parsePriceKrwInput(String(value));
  } catch {
    return null;
  }
}
