// ============================================================================
// Edge Function: seller-rankings
// Purpose: Seller ranking data — leaderboard of influencers by deal activity.
//
// Provides:
//   - Ranking (all sellers sorted by active deal count)
//   - Following (sellers the user follows)
//   - Category filtering (beauty, fashion, food, lifestyle, baby, digital)
//   - Period filtering (today, weekly, monthly)
//   - Sort modes (popular, rising, deadlineSoon, newDeal, brand)
//
// Deploy: supabase functions deploy seller-rankings
// Invoke: POST /functions/v1/seller-rankings
//   { "tab": "ranking", "category": "all", "period": "weekly", "sort": "popular" }
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

// ─── Types ───────────────────────────────────────────────────────────────────

type RankingTab = 'ranking' | 'following';
type RankingCategory = 'all' | 'beauty' | 'fashion' | 'food' | 'lifestyle' | 'baby' | 'digital';
type RankingPeriod = 'today' | 'weekly' | 'monthly';
type RankingSort = 'popular' | 'rising' | 'deadlineSoon' | 'newDeal' | 'brand';

interface RankingRequest {
  tab: RankingTab;
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
  userId?: string;
}

type RankingTrend =
  | { kind: 'up'; delta: number }
  | { kind: 'down'; delta: number }
  | { kind: 'same' }
  | { kind: 'new' };

interface RankingThumbnail {
  id: string;
  imageUrl: string | null;
  label?: string | null;
  groupBuyId?: string | null;
}

interface SellerRanking {
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
}

interface RankingResponse {
  data: SellerRanking[];
}

// ─── CORS ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

function generateMockRankings(request: RankingRequest): SellerRanking[] {
  const categories: Exclude<RankingCategory, 'all'>[] = [
    'beauty', 'fashion', 'food', 'lifestyle', 'baby', 'digital',
  ];

  const sellers = [
    { name: '뷰티인플루언서', username: 'beauty_star', avatar: null, category: 'beauty' as const },
    { name: '패션리더', username: 'fashion_leader', avatar: null, category: 'fashion' as const },
    { name: '맛집탐방', username: 'food_explorer', avatar: null, category: 'food' as const },
    { name: '라이프스타일', username: 'lifestyle_guru', avatar: null, category: 'lifestyle' as const },
    { name: '맘블로거', username: 'mom_blogger', avatar: null, category: 'baby' as const },
    { name: '테크리뷰어', username: 'tech_reviewer', avatar: null, category: 'digital' as const },
    { name: '스킨케어전문', username: 'skincare_pro', avatar: null, category: 'beauty' as const },
    { name: '스트리트패션', username: 'street_fashion', avatar: null, category: 'fashion' as const },
    { name: '집및선생', username: 'homecook_master', avatar: null, category: 'food' as const },
    { name: '홈데코', username: 'home_deco', avatar: null, category: 'lifestyle' as const },
  ];

  // Filter by category
  let filtered = request.category === 'all'
    ? sellers
    : sellers.filter((s) => s.category === request.category);

  // Build mock rankings
  return filtered.map((seller, i) => {
    const prevRank = i + 1 + (Math.floor(Math.random() * 5) - 2);
    let trend: RankingTrend;
    if (prevRank !== i + 1) {
      trend = { kind: prevRank > i + 1 ? 'up' : 'down', delta: Math.abs(prevRank - (i + 1)) };
    } else {
      trend = { kind: 'same' };
    }

    return {
      id: `seller-${seller.username}`,
      sellerId: `seller-${seller.username}`,
      rank: i + 1,
      previousRank: i > 0 ? prevRank : null,
      trend: i === 0 ? { kind: 'new' } : trend,
      displayName: seller.name,
      username: seller.username,
      avatarUrl: seller.avatar,
      category: seller.category,
      activeDealCount: Math.floor(Math.random() * 10) + 1,
      endingSoonCount: Math.floor(Math.random() * 3),
      trustScore: Math.round((70 + Math.random() * 30) * 10) / 10,
      isFollowing: i < 3,
      isSponsored: i % 3 === 0,
      thumbnails: Array.from({ length: Math.min(i + 1, 3) }, (_, j) => ({
        id: `thumb-${seller.username}-${j}`,
        imageUrl: `https://picsum.photos/seed/${seller.username}-${j}/200/200`,
        label: `Deal ${j + 1}`,
        groupBuyId: `gb-${seller.username}-${j}`,
      })),
      representativeGroupBuyId: `gb-${seller.username}-0`,
    };
  });
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Only POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Parse request
  let rankingReq: RankingRequest;
  try {
    rankingReq = await req.json() as RankingRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Determine if we should use mock or live data
    const useMock = Deno.env.get('SELLER_RANKINGS_MOCK') === 'true' ||
      !Deno.env.get('SUPABASE_URL');

    let rankings: SellerRanking[];

    if (useMock) {
      rankings = generateMockRankings(rankingReq);
    } else {
      // Live data from PostgREST query
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Query influencers (active)
      const { data: influencers, error } = await supabase
        .from('influencers')
        .select('id, instagram_username, display_name, profile_image_url')
        .eq('is_active', true)
        .order('instagram_username', { ascending: true });

      if (error) throw new Error(error.message);

      // Query approved group buys (flat — no embedded joins to avoid schema-cache issues)
      const { data: allGroupBuys, error: gbError } = await supabase
        .from('group_buys')
        .select('id, product_name, brand_name, category, end_date, status, thumbnail_url, media_items, raw_post_id')
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });

      if (gbError) throw new Error(gbError.message);

      // Query raw_posts to map group_buy -> influencer
      const rawPostIds = (allGroupBuys ?? []).map((gb: any) => gb.raw_post_id).filter(Boolean);
      const influencerByRawPost = new Map<string, string>();
      if (rawPostIds.length > 0) {
        const { data: rawPosts, error: rpError } = await supabase
          .from('raw_posts')
          .select('id, influencer_id')
          .in('id', rawPostIds);
        if (rpError) throw new Error(rpError.message);
        for (const rp of rawPosts ?? []) {
          influencerByRawPost.set(rp.id, rp.influencer_id);
        }
      }

      // Index group buys by influencer id
      const dealsByInfluencer = new Map<string, any[]>();
      for (const gb of allGroupBuys ?? []) {
        const infId = influencerByRawPost.get(gb.raw_post_id);
        if (!infId) continue;
        if (!dealsByInfluencer.has(infId)) dealsByInfluencer.set(infId, []);
        dealsByInfluencer.get(infId)!.push(gb);
      }

      // Fetch popularity scores per group buy (deep views + bookmarks)
      const { data: popularRows, error: popError } = await supabase
        .rpc('get_popular_group_buys', { limit_count: 100, hours_window: 168 });
      if (popError) throw new Error(popError.message);

      const scoreMap = new Map<string, number>();
      const viewMap = new Map<string, number>();
      for (const row of popularRows ?? []) {
        scoreMap.set(row.group_buy_id, Number(row.score));
        viewMap.set(row.group_buy_id, Number(row.deep_views));
      }

      // Aggregate per seller: sum of deal scores, plus collect thumbnails
      const sellerAgg = (influencers ?? []).map((inf: any) => {
        const sellerDeals = dealsByInfluencer.get(inf.id) ?? [];
        const activeDeals = sellerDeals.filter(
          (gb: any) => !gb.end_date || new Date(gb.end_date) > new Date(),
        );

        // Sum popularity scores for this seller's deals
        const sellerScore = activeDeals.reduce(
          (sum: number, gb: any) => sum + (scoreMap.get(gb.id) ?? 0),
          0,
        );
        const endingSoonCount = activeDeals.filter(
          (gb: any) => gb.end_date && new Date(gb.end_date).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000,
        ).length;

        // Derive category from the seller's most popular deal
        const dealsByScore = [...activeDeals].sort(
          (a: any, b: any) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
        );
        const category = (dealsByScore[0]?.category ?? 'lifestyle') as Exclude<RankingCategory, 'all'>;

        // Thumbnails: top deals by score, with real image URLs
        const thumbnails: RankingThumbnail[] = dealsByScore.slice(0, 3).map((deal: any) => {
          const thumb = deal.thumbnail_url
            ?? deal.media_items?.find((m: any) => m.thumbnailUrl)?.thumbnailUrl
            ?? deal.media_items?.find((m: any) => m.url && (m.mediaType === 'IMAGE' || !m.mediaType))?.url
            ?? null;
          return {
            id: `thumb-${deal.id}`,
            imageUrl: thumb,
            label: deal.product_name,
            groupBuyId: deal.id,
          };
        });

        return {
          seller: inf,
          sellerScore,
          activeDealCount: activeDeals.length,
          endingSoonCount,
          category,
          thumbnails,
          representativeGroupBuyId: dealsByScore[0]?.id ?? null,
        };
      });

      // Sort sellers by popularity score (real "인기" ranking), tiebreak by deal count
      sellerAgg.sort((a, b) => b.sellerScore - a.sellerScore || b.activeDealCount - a.activeDealCount);

      // Build ranking output
      rankings = sellerAgg.map((agg, i) => ({
        id: `seller-${agg.seller.id}`,
        sellerId: agg.seller.id,
        rank: i + 1,
        previousRank: null,
        trend: { kind: 'new' } as RankingTrend,
        displayName: agg.seller.display_name ?? agg.seller.instagram_username,
        username: agg.seller.instagram_username,
        avatarUrl: agg.seller.profile_image_url,
        category: agg.category,
        activeDealCount: agg.activeDealCount,
        endingSoonCount: agg.endingSoonCount,
        trustScore: null,
        isFollowing: false,
        isSponsored: false,
        thumbnails: agg.thumbnails,
        representativeGroupBuyId: agg.representativeGroupBuyId,
      }));
    }

    const response: RankingResponse = { data: rankings };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[seller-rankings] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
