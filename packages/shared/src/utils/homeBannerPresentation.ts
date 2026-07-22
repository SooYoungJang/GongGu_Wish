export type HomeBannerPresentationInput = {
  priceKrw?: number | null;
  discountInfo?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type HomeBannerStatusCopy = {
  accentLabel: string;
  accessibilityLabel: string;
  detailLabel?: string;
  secondaryLabel?: string;
  priceKrw: number | null;
  pricePlacement?: "detail" | "secondary";
};

const DAY_IN_MS = 86_400_000;

function formatPriceKrw(value: number | null) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function parsePromoDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;

  const trimmedValue = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
  if (dateOnlyMatch) {
    const [, yearValue, monthValue, dayValue] = dateOnlyMatch;
    const year = Number(yearValue);
    const month = Number(monthValue) - 1;
    const day = Number(dayValue);
    const date = new Date(
      year,
      month,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );

    return date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(trimmedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePromoPrice(rawPrice: string | undefined) {
  if (!rawPrice) return null;
  const numericPrice = Number(rawPrice.replace(/,/g, ""));
  if (!Number.isSafeInteger(numericPrice) || numericPrice <= 0) return null;
  return numericPrice;
}

function getPromoPriceKrw(discountInfo: string | null | undefined) {
  if (!discountInfo) return null;

  const labeledPrices = Array.from(
    discountInfo.matchAll(
      /(?:공구가|판매가|할인가|최종가|특가|가격)\s*[:：]?\s*(?:₩\s*)?([0-9][0-9,]*)(?:\s*원|\b(?!\s*%))/gi,
    ),
  );
  const labeledPrice = labeledPrices.at(-1)?.[1];
  if (labeledPrice) return parsePromoPrice(labeledPrice);

  const candidates = [
    ...Array.from(
      discountInfo.matchAll(
        /([0-9][0-9,]*)\s*원(?!\s*(?:할인|쿠폰|적립|혜택|지원))/g,
      ),
      (match) => ({ index: match.index, rawPrice: match[1] }),
    ),
    ...Array.from(discountInfo.matchAll(/₩\s*([0-9][0-9,]*)/g), (match) => ({
      index: match.index,
      rawPrice: match[1],
    })),
  ]
    .filter(({ index }) => {
      const matchIndex = index ?? 0;
      const precedingCopy = discountInfo.slice(Math.max(0, matchIndex - 16), matchIndex);
      return !/(?:배송비|배송료|택배비|운임|수수료|보증금|예약금|쿠폰|적립금?|지원금?|혜택)\s*[:：]?\s*$/i.test(
        precedingCopy,
      );
    })
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

  return candidates.length === 1
    ? parsePromoPrice(candidates[0].rawPrice)
    : null;
}

function getPromoDiscountPercent(discountInfo: string | null | undefined) {
  if (!discountInfo) return null;

  const patterns = [
    /(?:할인율|할인|특가|OFF)\s*[:：]?\s*([0-9]{1,3})\s*%/i,
    /([0-9]{1,3})\s*%\s*(?:할인|특가|OFF)/i,
    /^\s*([0-9]{1,2})\s*%(?=\s+(?:₩|[0-9][0-9,]*\s*원))/i,
  ];

  for (const pattern of patterns) {
    const match = discountInfo.match(pattern);
    const percent = match ? Number(match[1]) : Number.NaN;
    if (Number.isInteger(percent) && percent > 0 && percent <= 100) {
      return percent;
    }
  }

  return null;
}

export function getHomeBannerStatusCopy(
  item: HomeBannerPresentationInput,
  now = new Date(),
): HomeBannerStatusCopy {
  const startDate = parsePromoDate(item.startDate);
  const endDate = parsePromoDate(item.endDate, true);

  if (endDate && endDate.getTime() < now.getTime()) {
    return { accentLabel: "공구 종료", accessibilityLabel: "공구 종료", priceKrw: null };
  }

  const directPriceKrw =
    typeof item.priceKrw === "number" ? item.priceKrw : null;
  const priceKrw = directPriceKrw ?? getPromoPriceKrw(item.discountInfo);
  const price = formatPriceKrw(priceKrw);
  const priceDescription = price ? `가격 ${price}` : "가격 공개 예정";
  const discountPercent = getPromoDiscountPercent(item.discountInfo);

  if (startDate && startDate.getTime() > now.getTime()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const daysUntilStart = Math.max(
      0,
      Math.round((startDay.getTime() - today.getTime()) / DAY_IN_MS),
    );
    const dateLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} 시작`;
    const timingLabel = daysUntilStart === 0 ? "오늘" : `D+${daysUntilStart}`;
    const spokenTiming =
      daysUntilStart === 0 ? "오늘 시작" : `${daysUntilStart}일 후 시작`;

    return {
      accentLabel: timingLabel,
      accessibilityLabel: `${spokenTiming}, ${dateLabel}, ${priceDescription}`,
      detailLabel: dateLabel,
      secondaryLabel: price ?? "가격 공개 예정",
      priceKrw,
      pricePlacement: priceKrw != null ? "secondary" : undefined,
    };
  }

  if (discountPercent && price) {
    return {
      accentLabel: `${discountPercent}%`,
      accessibilityLabel: `${discountPercent}% 할인, ${priceDescription}`,
      detailLabel: price,
      priceKrw,
      pricePlacement: priceKrw != null ? "detail" : undefined,
    };
  }

  if (discountPercent) {
    return {
      accentLabel: `${discountPercent}%`,
      accessibilityLabel: `${discountPercent}% 할인, 가격 미정`,
      detailLabel: "가격 미정",
      priceKrw,
    };
  }

  if (price) {
    return {
      accentLabel: "공구 진행 중",
      accessibilityLabel: `공구 진행 중, ${priceDescription}`,
      detailLabel: price,
      priceKrw,
      pricePlacement: priceKrw != null ? "detail" : undefined,
    };
  }

  return {
    accentLabel: "공구 진행 중",
    accessibilityLabel: "공구 진행 중, 가격 미정",
    detailLabel: "가격 미정",
    priceKrw,
  };
}
