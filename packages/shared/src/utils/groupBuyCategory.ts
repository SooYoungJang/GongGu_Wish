import type { GroupBuyCategory } from "../schemas/group-buy";

export const GROUP_BUY_CATEGORY_LABELS: Record<GroupBuyCategory, string> = {
  food: "식품",
  living: "생활용품",
  beauty: "뷰티",
  fashion: "패션",
  home: "홈인테리어",
  kitchen: "주방용품",
  electronics: "전자제품",
  pet: "반려동물",
  auto: "자동차용품",
  hobby: "취미",
  baby: "육아",
  sports: "스포츠",
  stationery: "문구",
  books: "도서",
  media: "음반-DVD",
  travel: "여행",
  lifestyle: "생활용품",
  digital: "전자제품",
};

export function getGroupBuyCategoryLabel(
  value: string | null | undefined,
): string | null {
  const category = value?.trim() ?? "";
  if (!category) return null;

  return GROUP_BUY_CATEGORY_LABELS[category as GroupBuyCategory] ?? category;
}
