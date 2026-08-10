export const KOREA_SIGNAL_LABELS = {
  hangul: "한글 캡션",
  krwPrice: "원화 가격",
  domesticCommerce: "국내 배송/커머스 신호",
} as const;

const HANGUL_RE = /[\uAC00-\uD7A3]/;
const KRW_PRICE_RE = /(?:₩|\bKRW\b|\d[\d,\.\s]*\s*원(?=\s|$|[,.!?]))/i;
const DOMESTIC_COMMERCE_RE =
  /(?:국내|한국|대한민국|무료배송|배송비|택배|배송|스마트스토어|네이버쇼핑|쿠팡|자사몰|오늘출발|도서산간)/i;

export interface KoreaCaptionSignals {
  hangul: boolean;
  krwPrice: boolean;
  domesticCommerce: boolean;
  signalCount: number;
  isKoreaCandidate: boolean;
}

export function classifyKoreaCaption(caption: string): KoreaCaptionSignals {
  const signals = {
    hangul: HANGUL_RE.test(caption),
    krwPrice: KRW_PRICE_RE.test(caption),
    domesticCommerce: DOMESTIC_COMMERCE_RE.test(caption),
  };
  const signalCount = Object.values(signals).filter(Boolean).length;

  return {
    ...signals,
    signalCount,
    isKoreaCandidate: signalCount >= 2,
  };
}
