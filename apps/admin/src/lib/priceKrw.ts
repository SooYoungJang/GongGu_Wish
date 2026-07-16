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

/** Validate a persisted API value without turning a contract failure into null. */
export function normalizePersistedPriceKrwValue(value: unknown): number | null {
  if (value === null) return null;
  if (value === undefined) {
    throw new Error("priceKrw is missing from the API response.");
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("priceKrw must be a number or numeric string.");
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error("priceKrw must be null or a non-negative integer.");
  }

  try {
    return parsePriceKrwInput(String(value));
  } catch {
    throw new Error("priceKrw must be a non-negative PostgreSQL INTEGER.");
  }
}

export function assertPersistedPriceMatches(
  expectedPrice: number | null,
  actualPrice: number | null,
) {
  if (actualPrice !== expectedPrice) {
    throw new Error(
      "저장된 가격을 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }
}
