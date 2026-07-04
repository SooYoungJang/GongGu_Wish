import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  CalendarScreen: { initialDate?: string };
  Detail: { groupBuy: GroupBuy };
  FeedDetail: { feedId: string };
  InfluencerGroupBuys: { influencerUsername: string; influencerDisplayName: string | null };
  SearchScreen: undefined;
  Admin: undefined;
  Login: undefined;
  Submit: undefined;
};

export type MainTabParamList = {
  Ranking: undefined;
  Reels: undefined;
  Home: undefined;
  Search: undefined;
  MyPage: undefined;
};

export type GroupBuyCategory = 'beauty' | 'fashion' | 'food' | 'lifestyle' | 'baby' | 'digital';

export type MediaAsset = {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  thumbnailUrl?: string | null;
};

export type GroupBuy = {
  id: string;
  productName: string | null;
  brandName: string | null;
  category?: GroupBuyCategory | null;
  startDate: string | null;
  endDate: string | null;
  purchaseUrl: string | null;
  discountInfo: string | null;
  summary: string | null;
  confidence: number;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaUrls: string[];
  mediaItems?: MediaAsset[];
  mediaType: 'IMAGE' | 'VIDEO' | null;
  isMonthlyFeatured?: boolean;
  monthlyFeaturedRank?: number | null;
  rawPost: {
    postUrl: string;
    influencer: {
      instagramUsername: string;
    };
  };
};

export type Influencer = {
  id: string;
  instagramUsername: string;
  displayName: string | null;
  isActive: boolean;
};

export type Submission = GroupBuy & {
  startDate: string | null;
  status: 'APPROVED' | 'REVIEW_REQUIRED' | 'REJECTED' | 'EXPIRED';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  rawPost: GroupBuy['rawPost'] & {
    caption: string;
    imageUrl?: string | null;
    collectedAt?: string;
    instagramPostId?: string;
  };
};

export type InfluencerForm = {
  instagramUsername: string;
  displayName: string;
};

/**
 * Instagram post metadata fetched from HikerAPI.
 * Returned by lookupInstagramUrl() — POST /api/v1/hiker-api/lookup.
 */
export interface InstagramMediaInfo {
  /** URL of the post's primary image */
  imageUrl: string | null;
  /** Best image for thumbnail (first carousel image or cover) */
  thumbnailUrl: string | null;
  /** Primary video URL if the post is a video/reel */
  videoUrl: string | null;
  /** Display-ready media URLs in post order */
  mediaUrls: string[];
  /** Ordered media assets with per-slide type information */
  mediaItems?: MediaAsset[];
  /** Dominant media type: IMAGE or VIDEO */
  mediaType: 'IMAGE' | 'VIDEO' | null;
  /** Post caption / summary text */
  caption: string | null;
  /** Number of likes */
  likeCount: number | null;
  /** Instagram username (handle without @) */
  username: string | null;
  /** ISO date string of when the post was published */
  takenAt: string | null;
}

export type SubmissionReviewForm = {
  productName: string;
  brandName: string;
  category?: GroupBuyCategory | '';
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  summary: string;
};

export type ManualSubmissionForm = {
  influencerUsername: string;
  influencerDisplayName: string;
  caption: string;
  postUrl: string;
  imageUrl: string;
  productName: string;
  brandName: string;
  category?: GroupBuyCategory | '';
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  summary: string;
};

export type PublicSubmissionForm = {
  productName: string;
  category: GroupBuyCategory;
  endDate: string;
  purchaseUrl: string;
  instagramUrl: string;
  imageUrl: string;
  summary: string;
};

export type FeedPost = {
  id: string;
  instagramUrl: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | null;
  caption: string | null;
  accountName: string | null;
  linkUrl: string | null;
  openDate: string | null;
  closeDate: string | null;
  isActive: boolean;
  sortOrder: number;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedPostListResponse = {
  items: FeedPost[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type StoreScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Ranking'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type SubmitScreenProps = NativeStackScreenProps<RootStackParamList, 'Submit'>;
export type DetailScreenProps = NativeStackScreenProps<RootStackParamList, 'Detail'>;
export type FeedDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'FeedDetail'>;
export type CalendarScreenProps = NativeStackScreenProps<RootStackParamList, 'CalendarScreen'>;
export type InfluencerGroupBuysScreenProps = NativeStackScreenProps<RootStackParamList, 'InfluencerGroupBuys'>;
export type AdminScreenProps = NativeStackScreenProps<RootStackParamList, 'Admin'>;
