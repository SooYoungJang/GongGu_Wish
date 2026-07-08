export type RankingTab = 'ranking' | 'following';

export type RankingCategory =
  | 'all'
  | 'food'
  | 'living'
  | 'beauty'
  | 'fashion'
  | 'home'
  | 'kitchen'
  | 'electronics'
  | 'pet'
  | 'auto'
  | 'hobby'
  | 'baby'
  | 'sports'
  | 'stationery'
  | 'books'
  | 'media'
  | 'travel';

export type RankingPeriod = 'today' | 'weekly' | 'monthly';

export type RankingSort = 'popular' | 'rising' | 'deadlineSoon' | 'newDeal';

export type RankingTrend =
  | { kind: 'up'; delta: number }
  | { kind: 'down'; delta: number }
  | { kind: 'same' }
  | { kind: 'new' };

export type RankingThumbnail = {
  id: string;
  imageUrl: string | null;
  label?: string | null;
  groupBuyId?: string | null;
};

export type SellerRanking = {
  id: string;
  sellerId: string;
  rank: number;
  previousRank: number | null;
  trend: RankingTrend;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  category: Exclude<RankingCategory, 'all'>;
  followerCount?: number | null;
  activeDealCount: number;
  endingSoonCount?: number | null;
  trustScore?: number | null;
  isFollowing: boolean;
  isSponsored: boolean;
  thumbnails: RankingThumbnail[];
  representativeGroupBuyId?: string | null;
};

export type SellerRankingQuery = {
  tab: RankingTab;
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
};

export type RankingLoadState =
  | { status: 'loading'; data?: SellerRanking[] }
  | { status: 'error'; data?: SellerRanking[]; message: string; retry?: () => void }
  | { status: 'empty'; message: string; action?: { label: string; onPress: () => void } }
  | { status: 'ready'; data: SellerRanking[]; refreshing?: boolean };

export function getRankingTrend(rank: number, previousRank: number | null): RankingTrend {
  if (previousRank == null) {
    return { kind: 'new' };
  }

  if (previousRank > rank) {
    return { kind: 'up', delta: previousRank - rank };
  }

  if (previousRank < rank) {
    return { kind: 'down', delta: rank - previousRank };
  }

  return { kind: 'same' };
}

export function formatCompactCount(value: number): string {
  if (value >= 10000) {
    const tenThousand = value / 10000;
    return `${Number.isInteger(tenThousand) ? tenThousand : tenThousand.toFixed(1)}만`;
  }

  if (value >= 1000) {
    const thousand = value / 1000;
    return `${Number.isInteger(thousand) ? thousand : thousand.toFixed(1)}천`;
  }

  return value.toLocaleString('ko-KR');
}

export const RANKING_CATEGORIES: readonly RankingCategory[] = [
  'all',
  'food',
  'living',
  'beauty',
  'fashion',
  'home',
  'kitchen',
  'electronics',
  'pet',
  'auto',
  'hobby',
  'baby',
  'sports',
  'stationery',
  'books',
  'media',
  'travel',
] as const;

export const RANKING_CATEGORY_LABELS: Record<RankingCategory, string> = {
  all: '전체',
  food: '식품',
  living: '생활용품',
  beauty: '뷰티',
  fashion: '패션',
  home: '홈인테리어',
  kitchen: '주방용품',
  electronics: '전자제품',
  pet: '반려동물',
  auto: '자동차용품',
  hobby: '취미',
  baby: '출산-육아',
  sports: '스포츠',
  stationery: '문구',
  books: '도서',
  media: '음반-DVD',
  travel: '여행',
};

export const RANKING_SORT_CHIPS: readonly { key: RankingSort; label: string }[] = [
  { key: 'popular', label: '인기 공구' },
  { key: 'rising', label: '급상승' },
  { key: 'newDeal', label: '신규 오픈' },
  { key: 'deadlineSoon', label: '마감임박' },
] as const;

export const RANKING_PERIOD_LABELS: Record<RankingPeriod, string> = {
  today: '오늘',
  weekly: '이번 주',
  monthly: '이번 달',
};
