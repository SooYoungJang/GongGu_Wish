export const GROUP_BUY_KEYWORDS = [
  "공구",
  "공동구매",
  "마켓",
  "오픈",
  "구매링크",
  "판매링크",
  "할인",
  "마감",
  "예약판매",
  "선착순",
  "프로모션",
  "특가",
] as const;

const HANGUL_RE = /[\uAC00-\uD7A3]/;
const KRW_PRICE_RE = /(?:₩|\bKRW\b|\d[\d,.\s]*\s*원(?=\s|$|[,.!?]))/i;
const DOMESTIC_COMMERCE_RE =
  /(?:국내|한국|대한민국|무료배송|배송비|택배|배송|스마트스토어|네이버쇼핑|쿠팡|자사몰|오늘출발|도서산간)/i;

export function isGroupBuyCandidate(caption: string) {
  const normalized = caption.toLocaleLowerCase("ko-KR");
  return GROUP_BUY_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLocaleLowerCase("ko-KR")),
  );
}

export function classifyKoreaCaption(caption: string) {
  const signals = {
    hangul: HANGUL_RE.test(caption),
    krwPrice: KRW_PRICE_RE.test(caption),
    domesticCommerce: DOMESTIC_COMMERCE_RE.test(caption),
  };
  const signalCount = Object.values(signals).filter(Boolean).length;
  return { ...signals, signalCount, isKoreaCandidate: signalCount >= 2 };
}
