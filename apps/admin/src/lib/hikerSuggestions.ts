export type HikerSuggestionCategory =
  | "food"
  | "living"
  | "beauty"
  | "fashion"
  | "home"
  | "kitchen"
  | "electronics"
  | "pet"
  | "auto"
  | "hobby"
  | "baby"
  | "sports"
  | "stationery"
  | "books"
  | "media"
  | "travel";

export type HikerSuggestionMediaType = "IMAGE" | "VIDEO" | null;

export type HikerSuggestionMediaItem = {
  mediaType?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

export type InferHikerSuggestionsInput = {
  caption?: string | null;
  currentProductName?: string | null;
  currentCategory?: string | null;
  mediaItems?: HikerSuggestionMediaItem[] | null;
  videoUrl?: string | null;
  mediaUrls?: Array<string | null | undefined> | null;
};

export type HikerSuggestions = {
  productName: string;
  category: HikerSuggestionCategory | "";
  mediaType: HikerSuggestionMediaType;
};

const MAX_PRODUCT_NAME_LENGTH = 80;

const CATEGORY_KEYWORDS: Record<HikerSuggestionCategory, string[]> = {
  food: [
    "food",
    "먹",
    "음식",
    "식품",
    "과일",
    "복숭아",
    "감귤",
    "고기",
    "한우",
    "커피",
    "간식",
    "반찬",
    "밀키트",
    "디저트",
  ],
  living: ["living", "생활", "생필품", "욕실", "청소", "세제", "수납", "정리"],
  beauty: [
    "beauty",
    "뷰티",
    "화장품",
    "스킨케어",
    "세럼",
    "앰플",
    "크림",
    "선크림",
    "립",
    "메이크업",
    "헤어",
    "샴푸",
  ],
  fashion: [
    "fashion",
    "패션",
    "의류",
    "가방",
    "신발",
    "원피스",
    "셔츠",
    "니트",
    "모자",
    "양말",
  ],
  home: ["home", "인테리어", "가구", "침구", "러그", "조명", "커튼", "매트리스", "거실", "침실"],
  kitchen: ["kitchen", "주방", "냄비", "프라이팬", "그릇", "컵", "텀블러", "식기", "칼", "도마"],
  electronics: [
    "electronics",
    "전자",
    "가전",
    "충전기",
    "케이블",
    "이어폰",
    "헤드폰",
    "스피커",
    "노트북",
    "스마트폰",
  ],
  pet: ["pet", "반려", "반려견", "반려묘", "강아지", "고양이", "하네스", "리드줄", "사료"],
  auto: ["auto", "자동차", "차량", "차량용", "카매트", "블랙박스", "와이퍼"],
  hobby: ["hobby", "취미", "공예", "diy", "만들기", "보드게임", "피규어", "퍼즐"],
  baby: ["baby", "육아", "아기", "유아", "베이비", "키즈", "젖병", "기저귀"],
  sports: ["sports", "운동", "스포츠", "헬스", "요가", "필라테스", "러닝", "등산", "골프", "테니스"],
  stationery: ["stationery", "문구", "노트", "펜", "다이어리", "스티커", "메모지"],
  books: ["books", "책", "도서", "소설", "에세이", "문제집", "그림책"],
  media: ["media", "음반", "앨범", "dvd", "블루레이", "영화", "음악"],
  travel: ["travel", "여행", "숙소", "호텔", "항공", "투어", "캐리어"],
};

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".mpeg", ".mpg", ".wmv"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".avif"];

export function inferHikerSuggestions(input: InferHikerSuggestionsInput): HikerSuggestions {
  return {
    productName: hasValue(input.currentProductName)
      ? input.currentProductName
      : inferProductName(input.caption),
    category: hasValue(input.currentCategory)
      ? (input.currentCategory as HikerSuggestionCategory)
      : inferCategory(input.caption),
    mediaType: inferMediaType(input),
  };
}

function hasValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function inferProductName(caption: string | null | undefined): string {
  for (const line of (caption ?? "").split(/\r?\n/)) {
    const productLine = normalizeProductLine(line);

    if (productLine.length === 0) {
      continue;
    }

    if (isHashtagOnlyLine(line) || isDateTimeOnlyLine(productLine) || isPriceOnlyLine(productLine)) {
      continue;
    }

    if (isPromoOnlyLine(productLine)) {
      continue;
    }

    return productLine.slice(0, MAX_PRODUCT_NAME_LENGTH);
  }

  return "";
}

function normalizeProductLine(line: string): string {
  return line
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N})\]]+$/u, "")
    .trim();
}

function isHashtagOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && /^(?:#[\p{L}\p{N}_-]+\s*)+$/u.test(trimmed);
}

function isDateTimeOnlyLine(line: string): boolean {
  return /^(?:\d{2,4}[./년-]\s*\d{1,2}(?:[./월-]\s*\d{1,2}일?)?(?:\s+\d{1,2}:\d{2})?|\d{1,2}:\d{2})(?:\s*(?:open|오픈|마감|시작|까지|부터))*$/iu.test(
    line,
  );
}

function isPriceOnlyLine(line: string): boolean {
  return /^[₩￦~\s\d,.+\-/%]+(?:원|만원|천원|개|세트|box|ea)?$/iu.test(line);
}

function isPromoOnlyLine(line: string): boolean {
  const promoWords =
    "(?:오늘만|공동구매|공구|오픈|open|마감|이벤트|event|sale|세일|할인|특가|예약|주문|문의|dm|댓글|프로필|링크|무료배송|한정수량)";
  return new RegExp(`^(?:${promoWords}[\\s!?.~·|:/-]*)+$`, "iu").test(line);
}

function inferCategory(caption: string | null | undefined): HikerSuggestionCategory | "" {
  const text = (caption ?? "").toLowerCase();
  const hashtags = Array.from(text.matchAll(/#([\p{L}\p{N}_-]+)/gu), (match) => match[1]);
  const scores = new Map<HikerSuggestionCategory, number>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [HikerSuggestionCategory, string[]]
  >) {
    let score = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }

      for (const hashtag of hashtags) {
        if (hashtag === category || hashtag.includes(keyword)) {
          score += 3;
        }
      }
    }

    scores.set(category, score);
  }

  const ranked = Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
  const [best, second] = ranked;

  if (!best || best[1] === 0 || (second && second[1] === best[1])) {
    return "";
  }

  return best[0];
}

function inferMediaType(input: InferHikerSuggestionsInput): HikerSuggestionMediaType {
  const urls = [
    input.videoUrl,
    ...(input.mediaUrls ?? []),
    ...(input.mediaItems ?? []).flatMap((item) => [item.url, item.thumbnailUrl]),
  ].filter(hasValue);

  if (hasValue(input.videoUrl)) {
    return "VIDEO";
  }

  if (
    (input.mediaItems ?? []).some((item) => item.mediaType?.toLowerCase().includes("video")) ||
    urls.some(hasVideoExtension)
  ) {
    return "VIDEO";
  }

  if (
    (input.mediaItems ?? []).some((item) => {
      const mediaType = item.mediaType?.toLowerCase() ?? "";
      return mediaType.includes("image") || mediaType.includes("photo");
    }) ||
    urls.some(hasImageExtension) ||
    urls.length > 0
  ) {
    return "IMAGE";
  }

  return null;
}

function hasVideoExtension(url: string): boolean {
  return hasExtension(url, VIDEO_EXTENSIONS);
}

function hasImageExtension(url: string): boolean {
  return hasExtension(url, IMAGE_EXTENSIONS);
}

function hasExtension(url: string, extensions: string[]): boolean {
  const path = url.toLowerCase().split(/[?#]/, 1)[0];
  return extensions.some((extension) => path.endsWith(extension));
}
