export function formatPriceKrw(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
