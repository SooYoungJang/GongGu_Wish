import type {
  GroupBuyRankingItem,
  RankingCategory,
  RankingPeriod,
  RankingSort,
  RankingTrend,
} from '@gonggu/shared/schemas/ranking';

export type {
  GroupBuyRankingItem,
  GroupBuyRankingQuery,
  GroupBuyRankingResponse,
  RankingCategory,
  RankingPeriod,
  RankingSort,
  RankingTrend,
} from '@gonggu/shared/schemas/ranking';

export type RankingThumbnail = {
  id: string;
  imageUrl: string | null;
  label?: string | null;
};

/** Local presentation state; ranking data itself remains the shared contract. */
export type RankingListItem = GroupBuyRankingItem & {
  isNotifying?: boolean;
};

export type RankingLoadState =
  | { status: 'loading'; data?: RankingListItem[]; refresh?: () => Promise<unknown> }
  | {
      status: 'error';
      data?: RankingListItem[];
      message: string;
      retry?: () => void;
      refresh?: () => Promise<unknown>;
    }
  | {
      status: 'empty';
      message: string;
      action?: { label: string; onPress: () => void };
      updatedAt?: number;
      refresh?: () => Promise<unknown>;
    }
  | {
      status: 'ready';
      data: RankingListItem[];
      refreshing?: boolean;
      updatedAt?: number;
      refresh?: () => Promise<unknown>;
    };

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

export function formatRankingUpdatedAt(updatedAt: number | null | undefined, now = Date.now()): string {
  if (!updatedAt || !Number.isFinite(updatedAt)) {
    return '최근 업데이트';
  }

  const elapsedMinutes = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  if (elapsedMinutes < 1) return '방금 업데이트';
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전 업데이트`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}시간 전 업데이트`;

  return `${Math.floor(elapsedHours / 24)}일 전 업데이트`;
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
  baby: '육아',
  sports: '스포츠',
  stationery: '문구',
  books: '도서',
  media: '음반-DVD',
  travel: '여행',
};

export const RANKING_SORT_CHIPS: readonly {
  key: RankingSort;
  label: string;
}[] = [
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
