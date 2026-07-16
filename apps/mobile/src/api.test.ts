import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchHomeBannerGroupBuys,
  fetchGroupBuyRankings,
  fetchGroupBuys,
  lookupInstagramUrl,
  postPublicJson,
  refreshGroupBuyMedia,
  syncBookmark,
  syncNotification,
} from './api';
import { configurePostgrest } from './lib/postgrest-client';

const sessionMocks = vi.hoisted(() => ({
  getSessionId: vi.fn(),
}));

vi.mock('./utils/session', () => sessionMocks);

const originalFetch = global.fetch;

describe('public data fetch diagnostics', () => {
  beforeEach(() => {
    configurePostgrest('sb_publishable_1234567890');
    sessionMocks.getSessionId.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('logs group buy failures separately from feed failures', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;

    await expect(fetchGroupBuys()).rejects.toThrow('Network request failed');

    expect(console.log).toHaveBeenCalledWith('[GroupBuys] fetch failed:', 'Network request failed');
  });

  it('sends ranking filters and cursor to the server-side group-buy contract', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        pageInfo: { limit: 2, hasMore: false, nextCursor: null },
        meta: {
          category: 'food',
          period: 'weekly',
          sort: 'rising',
          scoreVersion: 'v2',
          generatedAt: '2026-07-16T00:00:00.000Z',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(
      fetchGroupBuyRankings({
        category: 'food',
        period: 'weekly',
        sort: 'rising',
        limit: 2,
        cursor: 'opaque-cursor',
      }),
    ).resolves.toMatchObject({ pageInfo: { hasMore: false } });

    const [requestUrl, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain('/functions/v1/seller-rankings');
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      category: 'food',
      period: 'weekly',
      sort: 'rising',
      limit: 2,
      cursor: 'opaque-cursor',
    });
  });

  it('rejects a malformed ranking response instead of exposing partial rows', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: {} }),
    }) as unknown as typeof fetch;

    await expect(
      fetchGroupBuyRankings({
        category: 'all',
        period: 'weekly',
        sort: 'popular',
        limit: 20,
      }),
    ).rejects.toThrow('Invalid group-buy ranking response');
  });

  it('does not enable a home banner when the backend omits the flag', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: 'legacy-group-buy',
          product_name: '레거시 공구',
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    const [item] = await fetchGroupBuys();

    expect(item.isHomeBanner).toBe(false);
  });

  it('asks PostgREST for only approved, active home banners', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    }) as unknown as typeof fetch;

    await expect(
      fetchHomeBannerGroupBuys(new Date(2026, 6, 13, 12)),
    ).resolves.toEqual([]);

    const requestUrl = String(vi.mocked(global.fetch).mock.calls[0]?.[0]);
    expect(requestUrl).toContain('status=eq.APPROVED');
    expect(requestUrl).toContain('is_home_banner=eq.true');
    expect(requestUrl).toContain('home_banner_start_date=lte.2026-07-13');
    expect(requestUrl).toContain('home_banner_end_date=gte.2026-07-13');
  });

  it('logs updatedAt revisions so stale or legacy banner responses are diagnosable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: 'banner-with-revision',
          product_name: '버전이 있는 홈 배너',
          category: 'food',
          confidence: 0,
          media_urls: [],
          media_items: [],
          media_type: null,
          is_home_banner: true,
          home_banner_start_date: '2026-07-13',
          home_banner_end_date: '2026-07-13',
          updated_at: '2026-07-12T10:00:00.000Z',
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    const result = await fetchHomeBannerGroupBuys(new Date(2026, 6, 13, 12));

    expect(result[0].updatedAt).toBe('2026-07-12T10:00:00.000Z');
    expect(console.log).toHaveBeenCalledWith('[HomeBanner] eligibility response', {
      asOf: '2026-07-13',
      count: 1,
      revisions: [
        {
          id: 'banner-with-revision',
          updatedAt: '2026-07-12T10:00:00.000Z',
        },
      ],
      legacyMissingUpdatedAt: [],
    });
  });

  it('rejects a malformed public group-buy response instead of exposing it to screens', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: 'malformed-group-buy',
          product_name: '잘못된 공구',
          confidence: 2,
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    await expect(fetchGroupBuys()).rejects.toThrow('Invalid public group buy response');
  });

  it('looks up Instagram metadata through the Supabase hiker function', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        imageUrl: 'https://example.com/post.jpg',
        caption: '테스트 게시물',
        likeCount: 42,
        username: 'gonggu_test',
        takenAt: '2026-07-04T07:00:00.000Z',
      }),
    }) as unknown as typeof fetch;

    await expect(lookupInstagramUrl('https://www.instagram.com/p/ABC123/')).resolves.toEqual({
      imageUrl: 'https://example.com/post.jpg',
      caption: '테스트 게시물',
      likeCount: 42,
      username: 'gonggu_test',
      takenAt: '2026-07-04T07:00:00.000Z',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/hiker-lookup'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.instagram.com/p/ABC123/' }),
      }),
    );
  });

  it('surfaces hiker lookup backend messages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: 'HikerAPI returned 502' }),
    }) as unknown as typeof fetch;

    await expect(lookupInstagramUrl('https://www.instagram.com/p/ABC123/')).rejects.toThrow(
      'HikerAPI returned 502',
    );
  });

  it('refreshes group buy media through the cached media refresh function', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        groupBuyId: 'group-buy-1',
        refreshed: true,
        source: 'hiker',
        instagramUrl: 'https://www.instagram.com/reel/ABC123/',
        media: {
          imageUrl: 'https://example.com/thumb.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          videoUrl: 'https://example.com/video.mp4',
          mediaUrls: ['https://example.com/video.mp4'],
          mediaType: 'VIDEO',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(refreshGroupBuyMedia('group-buy-1')).resolves.toMatchObject({
      groupBuyId: 'group-buy-1',
      refreshed: true,
      media: {
        videoUrl: 'https://example.com/video.mp4',
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/refresh-instagram-media'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ groupBuyId: 'group-buy-1' }),
      }),
    );
  });

  it('posts public submissions through the Supabase public-submission function', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'submission-123', status: 'PENDING' }),
    }) as unknown as typeof fetch;

    await expect(
      postPublicJson('/submissions', {
        productName: '테스트 공구',
        instagramUrl: 'https://www.instagram.com/p/ABC123/',
        imageUrls: [],
        isAnonymous: true,
      }),
    ).resolves.toEqual({ id: 'submission-123', status: 'PENDING' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/public-submission'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          productName: '테스트 공구',
          instagramUrl: 'https://www.instagram.com/p/ABC123/',
          imageUrls: [],
          isAnonymous: true,
        }),
      }),
    );
  });

  it('surfaces public submission edge function errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: '제품명은 2자 이상 필수입니다.' }),
    }) as unknown as typeof fetch;

    await expect(postPublicJson('/submissions', { productName: '' })).rejects.toThrow(
      '제품명은 2자 이상 필수입니다.',
    );
  });

  it('swallows session lookup failures for popularity sync requests', async () => {
    const sessionError = new TypeError("Cannot read property 'reload' of undefined");
    sessionMocks.getSessionId.mockRejectedValue(sessionError);

    await expect(syncBookmark('group-buy-1', true)).resolves.toBeUndefined();
    await expect(syncNotification('group-buy-1', true)).resolves.toBeUndefined();
  });
});
