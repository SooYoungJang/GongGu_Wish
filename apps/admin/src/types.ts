export type SubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DUPLICATE"
  | "CANCELLED";

export type GroupBuyStatus =
  | "APPROVED"
  | "REVIEW_REQUIRED"
  | "REJECTED"
  | "EXPIRED";

export type CollectionReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CollectionProfileLinkCandidate = {
  url: string;
  label: string | null;
  source: "PLAYWRIGHT_PROFILE";
};

export type CollectionReviewSnapshot = {
  schemaVersion: 1;
  rawPostId: string | null;
  instagramPostId: string | null;
  originalPostUrl: string | null;
  takenAt: string | null;
  productName: string | null;
  brandName: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  purchaseUrl: string | null;
  profileLinkCandidates: CollectionProfileLinkCandidate[];
  discountInfo: string | null;
  priceKrw: number | null;
  summary: string | null;
  thumbnailUrl: string | null;
  mediaUrls: string[];
  mediaItems: MediaAsset[];
  mediaType: "IMAGE" | "VIDEO" | null;
  confidence: number | null;
  postAudioUrl: string | null;
  postAudioStartTimeMs: number | null;
  postAudioDurationMs: number | null;
  isHomeBanner: boolean;
  homeBannerStartDate: string | null;
  homeBannerEndDate: string | null;
};

export type GroupBuyRequestStatus = "OPEN" | "FULFILLED" | "HIDDEN";

export type MediaAsset = {
  url: string;
  mediaType: "IMAGE" | "VIDEO";
  thumbnailUrl?: string | null;
};

export type SubmissionNotificationDelivery = {
  status:
    | "NOT_STARTED"
    | "NO_RECIPIENTS"
    | "PENDING"
    | "SENT"
    | "PARTIAL"
    | "SKIPPED"
    | "FAILED";
  linkedSubmitterCount: number;
  pendingCount: number;
  processingCount: number;
  sentCount: number;
  skippedCount: number;
  retryingCount: number;
  failedCount: number;
};

export type SubmissionApprovalDeliverySummary = {
  status: "sent" | "skipped" | "retrying" | "failed";
  queued: number;
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
};

export type GongguSubmission = {
  id: string;
  productName: string | null;
  brandName: string | null;
  instagramUsername: string | null;
  profileImageUrl?: string | null;
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
  postAudioUrl?: string | null;
  postAudioStartTimeMs?: number | null;
  postAudioDurationMs?: number | null;
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
  notificationDelivery?: SubmissionNotificationDelivery | null;
};

export type GroupBuy = {
  id: string;
  productName: string | null;
  brandName: string | null;
  instagramUsername: string | null;
  profileImageUrl?: string | null;
  originalPostUrl: string | null;
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
  postAudioUrl?: string | null;
  postAudioStartTimeMs?: number | null;
  postAudioDurationMs?: number | null;
  confidence: number | null;
  status: GroupBuyStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  collectionReviewStatus: CollectionReviewStatus | null;
  collectionProposalSnapshot: CollectionReviewSnapshot | null;
  collectionReviewedSnapshot: CollectionReviewSnapshot | null;
  collectionRulesetVersion: string | null;
  collectionHikerUsed: boolean;
  collectionHikerLookupAt: string | null;
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

export type GroupBuyRequest = {
  id: string;
  productName: string;
  status: GroupBuyRequestStatus;
  requestCount: number;
  createdAt: string;
  latestRequestedAt: string | null;
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
  hasPushToken: boolean;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type CommentModerationItem = {
  id: string;
  groupBuyId: string;
  productName: string | null;
  parentId: string | null;
  body: string | null;
  authorDisplayName: string | null;
  state: "VISIBLE" | "HIDDEN" | "DELETED" | "ACCOUNT_ANONYMIZED";
  likeCount: number;
  reportCount: number;
  contentVersion: number;
  createdAt: string;
  editedAt: string | null;
};

export type PushNotificationInput = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  userIds?: string[];
  marketing?: boolean;
};

export type PushNotificationResult = {
  provider: "expo";
  audienceType?:
    | "general"
    | "new_submission"
    | "deadline"
    | "marketing"
    | "influencer"
    | "brand";
  targeted: number;
  preferenceFiltered?: number;
  sent: number;
  failed: number;
  invalidTokensRemoved: number;
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
  postAudioUrl?: string | null;
  postAudioStartTimeMs?: number | null;
  postAudioDurationMs?: number | null;
  postAudioLookupStatus?: "FOUND" | "NONE" | "RETRYABLE";
  caption: string | null;
  likeCount: number | null;
  username: string | null;
  profileImageUrl?: string | null;
  takenAt: string | null;
  suggestions?: HikerLlmSuggestions;
};

export type HikerLlmSuggestions = {
  productName: string;
  brandName: string;
  category: string;
  discountInfo: string;
  startDate: string;
  endDate: string;
  priceKrw: string;
};

export type CdnRefreshStatus =
  | "expired"
  | "expiring"
  | "healthy"
  | "unknown"
  | "no_cdn";

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
