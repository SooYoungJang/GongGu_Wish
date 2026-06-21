import { Injectable } from '@nestjs/common';
import { RankingTab, RankingCategory, RankingPeriod, RankingSort, SellerRankingQueryDto } from './dto/seller-ranking-query.dto';

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
  category: string;
  followerCount?: number | null;
  activeDealCount: number;
  endingSoonCount?: number | null;
  trustScore?: number | null;
  isFollowing: boolean;
  isSponsored: boolean;
  thumbnails: RankingThumbnail[];
  representativeGroupBuyId?: string | null;
};

function getRankingTrend(rank: number, previousRank: number | null): RankingTrend {
  if (previousRank == null) return { kind: 'new' };
  if (previousRank > rank) return { kind: 'up', delta: previousRank - rank };
  if (previousRank < rank) return { kind: 'down', delta: rank - previousRank };
  return { kind: 'same' };
}

const thumbnail = (id: string, label: string) => ({
  id,
  imageUrl: null,
  label,
  groupBuyId: `group-${id}`,
});

const STATIC_RANKINGS: SellerRanking[] = [
  {
    id: 'rank-1', sellerId: 'seller-ovenfresh', rank: 1, previousRank: 4,
    trend: getRankingTrend(1, 4), displayName: '오븐프레시 마켓', username: 'ovenfresh.market',
    avatarUrl: null, category: RankingCategory.food, followerCount: 48200, activeDealCount: 12,
    endingSoonCount: 3, trustScore: 98, isFollowing: true, isSponsored: false,
    thumbnails: [thumbnail('oven-1', '그래놀라'), thumbnail('oven-2', '무화과잼'), thumbnail('oven-3', '버터쿠키')],
    representativeGroupBuyId: 'group-oven-1',
  },
  {
    id: 'rank-2', sellerId: 'seller-mellowmom', rank: 2, previousRank: 1,
    trend: getRankingTrend(2, 1), displayName: '멜로우맘 키즈', username: 'mellowmom.kids',
    avatarUrl: null, category: RankingCategory.baby, followerCount: 31500, activeDealCount: 8,
    endingSoonCount: 2, trustScore: 95, isFollowing: false, isSponsored: false,
    thumbnails: [thumbnail('mom-1', '등원룩'), thumbnail('mom-2', '간식팩'), thumbnail('mom-3', '세제')],
    representativeGroupBuyId: 'group-mom-1',
  },
  {
    id: 'rank-3', sellerId: 'seller-glowpick', rank: 3, previousRank: null,
    trend: getRankingTrend(3, null), displayName: '글로우픽 뷰티', username: 'glowpick.beauty',
    avatarUrl: null, category: RankingCategory.beauty, followerCount: 62100, activeDealCount: 15,
    endingSoonCount: 5, trustScore: 96, isFollowing: false, isSponsored: true,
    thumbnails: [thumbnail('glow-1', '비타세럼'), thumbnail('glow-2', '선쿠션'), thumbnail('glow-3', '클렌저')],
    representativeGroupBuyId: 'group-glow-1',
  },
  {
    id: 'rank-4', sellerId: 'seller-studiofit', rank: 4, previousRank: 4,
    trend: getRankingTrend(4, 4), displayName: '스튜디오핏', username: 'studiofit.daily',
    avatarUrl: null, category: RankingCategory.fashion, followerCount: 27700, activeDealCount: 6,
    endingSoonCount: 1, trustScore: 91, isFollowing: true, isSponsored: false,
    thumbnails: [thumbnail('fit-1', '니트'), thumbnail('fit-2', '코트')],
    representativeGroupBuyId: 'group-fit-1',
  },
  {
    id: 'rank-5', sellerId: 'seller-livingnote', rank: 5, previousRank: 9,
    trend: getRankingTrend(5, 9), displayName: '리빙노트', username: 'livingnote.home',
    avatarUrl: null, category: RankingCategory.lifestyle, followerCount: 39800, activeDealCount: 10,
    endingSoonCount: 4, trustScore: 93, isFollowing: false, isSponsored: false,
    thumbnails: [thumbnail('living-1', '수납함'), thumbnail('living-2', '디퓨저'), thumbnail('living-3', '침구')],
    representativeGroupBuyId: 'group-living-1',
  },
  {
    id: 'rank-6', sellerId: 'seller-techpick', rank: 6, previousRank: 5,
    trend: getRankingTrend(6, 5), displayName: '테크픽 공구', username: 'techpick.gadget',
    avatarUrl: null, category: RankingCategory.digital, followerCount: 18200, activeDealCount: 4,
    endingSoonCount: 0, trustScore: 89, isFollowing: false, isSponsored: false,
    thumbnails: [thumbnail('tech-1', '충전기'), thumbnail('tech-2', '키보드'), thumbnail('tech-3', '허브')],
    representativeGroupBuyId: 'group-tech-1',
  },
];

@Injectable()
export class RankingService {
  private readonly rankings: SellerRanking[] = STATIC_RANKINGS;

  list(query: SellerRankingQueryDto): { data: SellerRanking[] } {
    let next: SellerRanking[] = [...this.rankings];

    if (query.tab === RankingTab.following) {
      next = next.filter((item) => item.isFollowing);
    }

    if (query.category && query.category !== RankingCategory.all) {
      next = next.filter((item) => item.category === query.category);
    }

    if (query.period === RankingPeriod.today) {
      next = next.sort((a, b) => (b.endingSoonCount ?? 0) - (a.endingSoonCount ?? 0) || a.rank - b.rank);
    }

    if (query.period === RankingPeriod.monthly) {
      next = next.sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0) || a.rank - b.rank);
    }

    if (query.sort === RankingSort.rising) {
      next = next.sort((a, b) => {
        const aDelta = a.trend.kind === 'up' ? a.trend.delta : 0;
        const bDelta = b.trend.kind === 'up' ? b.trend.delta : 0;
        return bDelta - aDelta || a.rank - b.rank;
      });
    }

    if (query.sort === RankingSort.deadlineSoon) {
      next = next.sort((a, b) => (b.endingSoonCount ?? 0) - (a.endingSoonCount ?? 0) || a.rank - b.rank);
    }

    if (query.sort === RankingSort.newDeal) {
      next = next.sort((a, b) => (a.trend.kind === 'new' ? -1 : 0) - (b.trend.kind === 'new' ? -1 : 0) || a.rank - b.rank);
    }

    if (query.sort === RankingSort.brand) {
      next = next.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko-KR'));
    }

    return { data: next };
  }
}
