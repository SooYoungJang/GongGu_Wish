import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callEdgeFunction, configurePostgrest, postgrestFetch } from './postgrest-client';

const tokenSourceMocks = vi.hoisted(() => ({
  client: null as any,
  getStoredAuthToken: vi.fn(),
}));

vi.mock('./supabase', () => ({
  getSupabaseIfConfigured: () => tokenSourceMocks.client,
}));

vi.mock('../utils/auth', () => ({
  getAuthToken: tokenSourceMocks.getStoredAuthToken,
}));

const originalFetch = global.fetch;

describe('postgrestFetch diagnostics', () => {
  beforeEach(() => {
    configurePostgrest('sb_publishable_1234567890');
    tokenSourceMocks.client = null;
    tokenSourceMocks.getStoredAuthToken.mockReset().mockResolvedValue(null);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('logs safe request and failure diagnostics when native fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;

    await expect(postgrestFetch('feed_posts')).rejects.toThrow('Network request failed');

    expect(console.log).toHaveBeenCalledTimes(2);

    expect(console.log).toHaveBeenNthCalledWith(1, '[PostgREST] request', {
      url: 'https://unconfigured.invalid/rest/v1/feed_posts',
      method: 'GET',
      apikey: { exists: true, length: 25, prefix: 'sb_publi' },
      hasAuthorization: false,
    });

    expect(console.log).toHaveBeenNthCalledWith(2, '[PostgREST] fetch failed', {
      url: 'https://unconfigured.invalid/rest/v1/feed_posts',
      name: 'TypeError',
      message: 'Network request failed',
      cause: undefined,
    });
  });

  it('uses one configured local Supabase origin for REST and Edge requests', async () => {
    configurePostgrest('local-anon-key', 'http://10.0.2.2:54321/');
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: [] }),
      }) as unknown as typeof fetch;

    await postgrestFetch('group_buys?select=id');
    await callEdgeFunction('seller-rankings', { limit: 1 }, { authToken: '' });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://10.0.2.2:54321/rest/v1/group_buys?select=id',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://10.0.2.2:54321/functions/v1/seller-rankings',
      expect.any(Object),
    );
  });

  it('prevents native HTTP caches from serving stale public GET data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue([]),
    }) as unknown as typeof fetch;

    await postgrestFetch('group_buys?select=id');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/group_buys?select=id'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        }),
        method: 'GET',
      }),
    );
  });

  it('uses the current Supabase session token instead of a stale stored mirror', async () => {
    tokenSourceMocks.getStoredAuthToken.mockResolvedValue('stored-stale-token');
    tokenSourceMocks.client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'current-session-token' } },
          error: null,
        }),
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue([]),
    }) as unknown as typeof fetch;

    await postgrestFetch('group_buys?select=id');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer current-session-token',
        }),
      }),
    );
    expect(tokenSourceMocks.getStoredAuthToken).not.toHaveBeenCalled();
  });

  it('omits authorization when the configured Supabase client has no session', async () => {
    tokenSourceMocks.getStoredAuthToken.mockResolvedValue('stored-stale-token');
    tokenSourceMocks.client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue([]),
    }) as unknown as typeof fetch;

    await postgrestFetch('group_buys?select=id');

    const request = vi.mocked(global.fetch).mock.calls[0][1];
    expect(request?.headers).not.toHaveProperty('Authorization');
    expect(tokenSourceMocks.getStoredAuthToken).not.toHaveBeenCalled();
  });

  it('does not fall back to a stale stored token when session refresh fails', async () => {
    tokenSourceMocks.getStoredAuthToken.mockResolvedValue('stored-stale-token');
    tokenSourceMocks.client = {
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error('session refresh failed')),
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue([]),
    }) as unknown as typeof fetch;

    await postgrestFetch('group_buys?select=id');

    const request = vi.mocked(global.fetch).mock.calls[0][1];
    expect(request?.headers).not.toHaveProperty('Authorization');
    expect(tokenSourceMocks.getStoredAuthToken).not.toHaveBeenCalled();
  });
});
