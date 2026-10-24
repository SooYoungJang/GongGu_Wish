import { describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  configureSupabase,
  createSupabaseAuthRequestClient,
  discardSupabaseAuthSession,
  getSupabase,
  syncSupabaseAuthAutoRefresh,
} from '../lib/supabase';

const {
  createClientMock,
  getSessionMock,
  startAutoRefreshMock,
  stopAutoRefreshMock,
  signOutMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  startAutoRefreshMock: vi.fn(),
  stopAutoRefreshMock: vi.fn(),
  signOutMock: vi.fn(),
  createClientMock: vi.fn(() => ({
    auth: {
      getSession: getSessionMock,
      startAutoRefresh: startAutoRefreshMock,
      stopAutoRefresh: stopAutoRefreshMock,
      signOut: signOutMock,
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

  it('isolates password requests from the persistent session and OAuth storage', () => {
    const shared = getSupabase();
    const first = createSupabaseAuthRequestClient();
    const second = createSupabaseAuthRequestClient();
    expect(first).not.toBe(shared);
    expect(second).not.toBe(first);
    expect(getSupabase()).toBe(shared);
    expect(createClientMock).toHaveBeenLastCalledWith(
      'http://10.0.2.2:54321',
      'test-anon-key',
      { auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: expect.stringMatching(/^gonggu\.auth-request\./),
      } },
    );
  });

  it('discards local auth storage without allowing an in-flight write to restore it', async () => {
    const options = (createClientMock.mock.calls as unknown[][])[0][2] as {
      auth: { storageKey: string; storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'> };
    };
    const { storageKey, storage: authStorage } = options.auth;
    expect(storageKey).toBe('sb-10-auth-token');
    const values = new Map([[storageKey, 'cancelled-session']]);
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve; });
    let releaseSignOut!: () => void;
    const signOutGate = new Promise<void>((resolve) => { releaseSignOut = resolve; });
    const getItem = vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => values.get(key) ?? null);
    const setItem = vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (value === 'in-flight-session') await writeGate;
      values.set(key, value);
    });
    const removeItem = vi.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key) => { values.delete(key); });
    signOutMock.mockReset().mockImplementationOnce(async () => {
      await signOutGate;
      return { error: null };
    });
    let discarded: Promise<void> | undefined;
    try {
      const oldWrite = authStorage.setItem(storageKey, 'in-flight-session');
      discarded = discardSupabaseAuthSession();
      await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' }));
      expect(await authStorage.getItem(storageKey)).toBeNull();
      await authStorage.setItem(storageKey, 'blocked-session');
      expect(setItem).toHaveBeenCalledTimes(1);
      releaseWrite();
      await oldWrite;
      expect(values.has(storageKey)).toBe(false);
      releaseSignOut();
      await discarded;
      await authStorage.setItem(storageKey, 'new-session');
      expect(await authStorage.getItem(storageKey)).toBe('new-session');
    } finally {
      releaseWrite();
      releaseSignOut();
      await discarded;
      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    }
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
