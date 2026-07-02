export interface ParsedSubmissionCaption {
  productName?: string;
  brandName?: string;
  startDate?: string;
  endDate?: string;
  purchaseUrl?: string;
  discountInfo?: string;
}

interface ParseOptions {
  referenceDate?: Date;
  fallbackBrandName?: string | null;
}

interface ParsedDate {
  year?: number;
  month: number;
  day: number;
}

const URL_RE = /https?:\/\/[^\s"'<>]+/i;

// Emoji and decorative symbols — Unicode property escapes cover regional
// indicators (flags), keycaps, ZWJ sequences, and pictographs the old
// hardcoded allowlist missed (which left broken surrogate pairs as "??").
// `Extended_Pictographic` + regional indicators covers flags without eating
// ASCII digits (which also carry the `Emoji` property in some Unicode versions).
const EMOJI_RE =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u200d\uFE0F\u20e3\ud800-\udfff]+/gu;

const DATE_TOKEN_RE =
  /(?:20\d{2}\s*[./-]\s*)?\d{1,2}\s*(?:[./-]|월)\s*\d{1,2}\s*(?:일)?/g;

function cleanLine(line: string) {
  return line
    .replace(/^[\s•\-–—*·]+/g, '')
    .replace(EMOJI_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(date: ParsedDate, referenceYear: number) {
  const year = date.year ?? referenceYear;
  return `${year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function parseDateToken(raw: string): ParsedDate | null {
  const token = raw.replace(/\s+/g, '');
  const yearMatch = token.match(/^(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (yearMatch) {
    return {
      year: Number(yearMatch[1]),
      month: Number(yearMatch[2]),
      day: Number(yearMatch[3]),
    };
  }

  const monthDayMatch = token.match(/^(\d{1,2})(?:[./-]|월)(\d{1,2})/);
  if (!monthDayMatch) return null;

  return {
    month: Number(monthDayMatch[1]),
    day: Number(monthDayMatch[2]),
  };
}

function datesInLine(line: string) {
  const matches = line.match(DATE_TOKEN_RE) ?? [];
  return matches.map(parseDateToken).filter((date): date is ParsedDate => Boolean(date));
}

function removeDateFragments(line: string) {
  return cleanLine(line)
    .replace(DATE_TOKEN_RE, ' ')
    .replace(/(?:부터|까지|마감|시작|오픈|open|start|end|close|[-~–—])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPurchaseUrl(caption: string) {
  return caption.match(URL_RE)?.[0]?.replace(/[),.]+$/g, '');
}

function extractDiscountInfo(lines: string[]) {
  const line = lines.find((item) =>
    /(?:\d{1,2}\s*%|할인|정가|판매가|공구가|특가|원\b|₩)/.test(item),
  );
  return line?.slice(0, 200);
}

function extractBrandFromProduct(productName: string) {
  // Reject URLs (e.g. "https://x..." or ".../x") that the "A x B" pattern
  // would otherwise misread as a brand name.
  if (URL_RE.test(productName)) return undefined;
  const xMatch = productName.match(/^(.{2,30}?)\s*(?:x|X|×)\s*(.+)$/);
  return xMatch?.[1]?.trim();
}

function extractBrandFromXLine(lines: string[]) {
  const xLine = lines.find(
    (line) => !URL_RE.test(line) && /^.{2,30}?\s*(?:x|X|×)\s*.{2,50}$/.test(line),
  );
  return xLine ? extractBrandFromProduct(xLine) : undefined;
}

function extractProductName(lines: string[], brandName?: string) {
  const candidates = lines.filter((line) => {
    if (!line || URL_RE.test(line) || line.startsWith('#')) return false;
    if (datesInLine(line).length > 0) return false;
    if (/^(댓글|문의|구매|링크|프로필|스토리|DM|디엠)\b/i.test(line)) return false;
    return line.length >= 2;
  });

  const gongguLine =
    candidates.find((line) => /공구/.test(line) && !/일정\s*(?:OPEN|오픈)?$/i.test(line)) ??
    candidates.find((line) => /공구/.test(line));

  if (gongguLine) return gongguLine.slice(0, 100);

  const titleLine = candidates.find((line) => line.length >= 5);
  if (titleLine) return titleLine.slice(0, 100);

  return brandName ? `${brandName} 공구` : undefined;
}

export function parseSubmissionCaption(
  caption: string | null | undefined,
  options: ParseOptions = {},
): ParsedSubmissionCaption {
  if (!caption?.trim()) return {};

  const referenceYear = (options.referenceDate ?? new Date()).getFullYear();
  const lines = caption
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  let startDate: string | undefined;
  let endDate: string | undefined;
  let brandName: string | undefined;

  for (const line of lines) {
    const dates = datesInLine(line);
    if (dates.length >= 2 && /(?:~|-|–|—|부터|까지)/.test(line)) {
      startDate = startDate ?? formatDate(dates[0], referenceYear);
      endDate = endDate ?? formatDate(dates[1], dates[0].year ?? referenceYear);
      const trailingText = removeDateFragments(line);
      if (trailingText && trailingText.length <= 50) {
        brandName = brandName ?? trailingText;
      }
      break;
    }

    if (dates.length === 1 && /(?:마감|종료|까지|close|end)/i.test(line)) {
      endDate = endDate ?? formatDate(dates[0], referenceYear);
    }
    if (dates.length === 1 && /(?:시작|오픈|부터|open|start)/i.test(line)) {
      startDate = startDate ?? formatDate(dates[0], referenceYear);
    }
  }

  let productName = extractProductName(lines, brandName);
  brandName =
    brandName ??
    extractBrandFromXLine(lines) ??
    (productName ? extractBrandFromProduct(productName) : undefined) ??
    options.fallbackBrandName ??
    undefined;

  if (
    brandName &&
    productName &&
    /(?:공구\s*일정|일정\s*(?:OPEN|오픈)|브랜드들과|공구\s*일정\s*오픈)/i.test(productName)
  ) {
    productName = `${brandName} 공구`;
  }

  return {
    productName,
    brandName,
    startDate,
    endDate,
    purchaseUrl: extractPurchaseUrl(caption),
    discountInfo: extractDiscountInfo(lines),
  };
}
