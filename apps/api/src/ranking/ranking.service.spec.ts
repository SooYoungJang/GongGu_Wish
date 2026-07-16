import { BadGatewayException } from '@nestjs/common';

import { RankingService } from './ranking.service';

function rankingRow(id: string, score: number) {
  return {
    group_buy_id: id,
    rank: score === 40 ? 1 : 2,
    previous_rank: null,
    trend_kind: 'up' as const,
    trend_delta: 5,
    product_name: `${id} 상품`,
    brand_name: '브랜드',
    username: 'ranking.market',
    category: 'food',
    thumbnail_url: null,
    media_urls: [],
    start_date: null,
    end_date: null,
    price_krw: 12000,
    created_at: '2026-07-16T00:00:00.000Z',
    deep_views: 10,
    bookmarks: 2,
    notifications: 1,
    search_clicks: 3,
    score,
    score_delta: 5,
    score_version: 'v2',
  };
}

describe('RankingService', () => {
  it('maps the RPC rows to the shared response and preserves cursor pagination', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [rankingRow('group-1', 40), rankingRow('group-2', 20)],
      error: null,
    });
    const service = new RankingService({ admin: { rpc } } as never);

    const response = await service.list({
      category: 'food' as never,
      period: 'weekly' as never,
      sort: 'popular' as never,
      limit: 1,
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      groupBuyId: 'group-1',
      metrics: {
        deepViews: 10,
        bookmarks: 2,
        notifications: 1,
        searchClicks: 3,
        score: 40,
      },
      scoreVersion: 'v2',
    });
    expect(response.pageInfo).toMatchObject({ limit: 1, hasMore: true });
    expect(response.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(rpc).toHaveBeenCalledWith('get_group_buy_rankings', {
      category_filter: 'food',
      period_filter: 'weekly',
      sort_filter: 'popular',
      limit_count: 2,
      cursor_numeric: null,
      cursor_timestamp: null,
      cursor_group_buy_id: null,
    });
  });

  it('surfaces RPC failures instead of returning an empty or mock ranking', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const service = new RankingService({ admin: { rpc } } as never);

    await expect(
      service.list({ category: 'all' as never, period: 'weekly' as never, sort: 'popular' as never }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
