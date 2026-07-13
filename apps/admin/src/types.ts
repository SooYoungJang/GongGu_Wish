export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "DUPLICATE" | "CANCELLED";

export type GroupBuyStatus = "APPROVED" | "REVIEW_REQUIRED" | "REJECTED" | "EXPIRED";

export type MediaAsset = {
  url: string;
  mediaType: "IMAGE" | "VIDEO";
  thumbnailUrl?: string | null;
};

export type GongguSubmission = {
  id: string;
  productName: string | null;
  brandName: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  purchaseUrl: string | null;
  discountInfo: string | null;
  priceKrw: number | null;
  summary: string | null;
  instagramUrl: string | null;
  imageUrls: string[];
  mediaItems: MediaAsset[];
  reporterName: string | null;
  reporterContact: string | null;
  isAnonymous: boolean;
  contentHash: string;
  status: SubmissionStatus;
  adminMemo: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  groupBuyId: string | null;
  isHomeBanner: boolean;
  homeBannerStartDate: string | null;
  homeBannerEndDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupBuy = {
  id: string;
  productName: string | null;
  brandName: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  purchaseUrl: string | null;
  discountInfo: string | null;
  priceKrw: number | null;
  summary: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaUrls: string[];
  mediaItems: MediaAsset[];
  mediaType: "IMAGE" | "VIDEO" | null;
  status: GroupBuyStatus;
  sourceType: string | null;
  submissionId: string | null;
  isAllDay: boolean;
  isMonthlyFeatured: boolean;
  monthlyFeaturedRank: number | null;
  isHomeBanner: boolean;
  homeBannerStartDate: string | null;
  homeBannerEndDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardResponse = {
  totals: {
    submissions: number;
    pending: number;
    approved: number;
    rejected: number;
    groupBuys: number;
    activeGroupBuys: number;
    users: number;
  };
  pendingQueue: GongguSubmission[];
  recentUsers: AppUser[];
  recentGroupBuys: GroupBuy[];
  categoryDistribution: Record<string, number>;
};

export type AppUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  fcmToken: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export type HikerLookupResult = {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaUrls: string[];
  mediaItems: MediaAsset[];
  mediaType: "IMAGE" | "VIDEO" | null;
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  takenAt: string | null;
  suggestions?: HikerLlmSuggestions;
};

export type HikerLlmSuggestions = {
  productName: string;
  brandName: string;
  category: string;
  discountInfo: string;
  confidence: number | null;
  reasoning: string;
};

export type CdnRefreshStatus = "expired" | "expiring" | "healthy" | "unknown" | "no_cdn";

export type CdnRefreshRow = {
  id: string;
  productName: string | null;
  brandName: string | null;
  category: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  endDate: string | null;
  updatedAt: string;
  mediaRefreshedAt: string | null;
  cdnExpiresAt: string | null;
  refreshStatus: CdnRefreshStatus;
  instagramUrl: string | null;
};

export type CdnRefreshSummary = {
  total: number;
  expired: number;
  expiring: number;
  healthy: number;
  unknown: number;
  noCdn: number;
};

export type CdnRefreshStatusResponse = {
  items: CdnRefreshRow[];
  summary: CdnRefreshSummary;
  lastRefreshedAt: string | null;
};

export type CdnRefreshResult = {
  groupBuyId?: string;
  refreshed?: boolean;
  source?: "cache" | "hiker" | "skipped";
  error?: string;
  results?: CdnRefreshResult[];
};
