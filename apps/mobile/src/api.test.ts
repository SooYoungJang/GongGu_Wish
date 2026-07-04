import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchGroupBuys, lookupInstagramUrl, postPublicJson, refreshGroupBuyMedia } from './api';
import { configurePostgrest } from './lib/postgrest-client';

const originalFetch = global.fetch;

describe('public data fetch diagnostics', () => {
  beforeEach(() => {
    configurePostgrest('sb_publishable_1234567890');
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
});
