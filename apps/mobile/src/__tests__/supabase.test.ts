import { describe, expect, it, vi } from 'vitest';
import {
  configureSupabase,
  getSupabase,
  syncSupabaseAuthAutoRefresh,
} from '../lib/supabase';

const {
  createClientMock,
  getSessionMock,
  startAutoRefreshMock,
  stopAutoRefreshMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  startAutoRefreshMock: vi.fn(),
  stopAutoRefreshMock: vi.fn(),
  createClientMock: vi.fn(() => ({
    auth: {
      getSession: getSessionMock,
      startAutoRefresh: startAutoRefreshMock,
      stopAutoRefresh: stopAutoRefreshMock,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('Supabase client', () => {
  it('throws when accessed before configure', () => {
    expect(() => getSupabase()).toThrow(
      'Supabase client not configured',
    );
  });

  it('configures auth against the requested local Supabase origin', () => {
    const client = configureSupabase('test-anon-key', 'http://10.0.2.2:54321/');
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'http://10.0.2.2:54321',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
        }),
      }),
    );
  });

  it('returns singleton on second configure call', () => {
    const client1 = configureSupabase('test-anon-key');
    const client2 = configureSupabase('test-another-key');
    expect(client1).toBe(client2);
  });

  it('runs Supabase auth refresh only while the native app is active', async () => {
    let releaseSession!: () => void;
    getSessionMock.mockReset().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSession = () =>
            resolve({ data: { session: null }, error: null });
        }),
    );
    startAutoRefreshMock.mockReset().mockResolvedValue(undefined);
    stopAutoRefreshMock.mockReset().mockResolvedValue(undefined);
    configureSupabase('test-anon-key');

    let activeSyncFinished = false;
    const activeSync = syncSupabaseAuthAutoRefresh('active', 'android').then(
      () => {
        activeSyncFinished = true;
      },
    );
    await vi.waitFor(() => {
      expect(startAutoRefreshMock).toHaveBeenCalledTimes(1);
      expect(getSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(activeSyncFinished).toBe(false);

    releaseSession();
    await activeSync;
    await syncSupabaseAuthAutoRefresh('background', 'android');
    await syncSupabaseAuthAutoRefresh('active', 'web');

    expect(startAutoRefreshMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(stopAutoRefreshMock).toHaveBeenCalledTimes(1);
  });
});
