export * from "./automatic-collection";

export const API_PATHS = {
  influencers: "/admin/influencers",
  submissions: "/admin/submissions",
  groupBuys: "/group-buys",
  adminGroupBuys: "/admin/group-buys",
  rawPosts: "/admin/raw-posts",
} as const;

export const GROUP_BUY_STATUS_LABELS: Record<string, string> = {
  APPROVED: "승인됨",
  REVIEW_REQUIRED: "검수 필요",
  REJECTED: "반려됨",
  EXPIRED: "종료됨",
};

export const PARSING_STATUS_LABELS: Record<string, string> = {
  NEW: "신규",
  PENDING: "대기 중",
  EXPORTED: "내보내기 완료",
  PARSED: "파싱 완료",
  NOT_GROUP_BUY: "공구 아님",
  FAILED: "실패",
};

export const STATUSColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEW_REQUIRED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-800",
} as const;
