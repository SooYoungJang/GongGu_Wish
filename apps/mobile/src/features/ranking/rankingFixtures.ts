import type {
  GroupBuyRankingItem,
  GroupBuyRankingQuery,
} from '@gonggu/shared/schemas/ranking';

export const MOCK_RANKINGS: GroupBuyRankingItem[] = [
  {
    groupBuyId: 'group-oven-1',
    rank: 1,
    previousRank: 4,
    trend: { kind: 'up', delta: 3 },
    productName: '그래놀라 공동구매',
    brandName: '오븐프레시',
    username: 'ovenfresh.market',
    category: 'food',
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: 12000,
    metrics: {
      deepViews: 48200,
      bookmarks: 12,
      notifications: 3,
      searchClicks: 18,
      score: 144666,
      scoreDelta: 48200,
    },
    scoreVersion: 'v2',
  },
  {
    groupBuyId: 'group-mom-1',
    rank: 2,
    previousRank: 1,
    trend: { kind: 'down', delta: 1 },
    productName: '등원룩 공동구매',
    brandName: '멜로우맘',
    username: 'mellowmom.kids',
    category: 'baby',
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: 31500,
    metrics: {
      deepViews: 31500,
      bookmarks: 8,
      notifications: 2,
      searchClicks: 11,
      score: 94527,
      scoreDelta: 10000,
    },
    scoreVersion: 'v2',
  },
];

export const MOCK_QUERY: GroupBuyRankingQuery = {
  category: 'all',
  period: 'weekly',
  sort: 'popular',
  limit: 20,
};
