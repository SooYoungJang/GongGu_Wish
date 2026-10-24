import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, type AppStateStatus } from 'react-native';

import { resolveSupabaseUrl } from './supabase-config';

let _supabase: SupabaseClient | null = null;
let authRequestConfig: { url: string; anonKey: string; storageKey: string } | null = null;
let authRequestSequence = 0;
let discardingAuthSession = false;

function createAuthStorage(storageKey: string) {
  return {
    getItem: (key: string) => discardingAuthSession && key === storageKey
      ? Promise.resolve(null) : AsyncStorage.getItem(key),
    setItem: async (key: string, value: string) => {
      if (discardingAuthSession && key === storageKey) return;
      await AsyncStorage.setItem(key, value);
      if (discardingAuthSession && key === storageKey) await AsyncStorage.removeItem(key);
    },
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  };
}

/**
 * Initialize the Supabase client with the anon key.
 * Must be called before any auth operations.
 */
export function configureSupabase(anonKey: string, supabaseUrl?: string): SupabaseClient {
  if (!_supabase) {
    const url = resolveSupabaseUrl(supabaseUrl);
    // Preserve Supabase's existing default namespace, including installed sessions.
    const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    _supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storageKey,
        storage: createAuthStorage(storageKey),
      },
    });
    authRequestConfig = { url, anonKey, storageKey };
  }
  return _supabase;
}

/** Authenticate without allowing a cancelled request to persist a shared session. */
export function createSupabaseAuthRequestClient(): SupabaseClient {
  if (!authRequestConfig) throw new Error('Supabase client not configured.');
  return createClient(authRequestConfig.url, authRequestConfig.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `gonggu.auth-request.${++authRequestSequence}`,
    },
  });
}

/** Discard a cancelled commit even when revoking its server session is offline. */
export async function discardSupabaseAuthSession(): Promise<void> {
  const supabase = getSupabase();
  if (!authRequestConfig) throw new Error('Supabase client not configured.');
  discardingAuthSession = true;
  try {
    await AsyncStorage.removeItem(authRequestConfig.storageKey);
    // An empty session skips the network revoke. The public SDK operation drains
    // its auth lock, resets refresh state, removes PKCE/user data and emits SIGNED_OUT.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } finally {
    discardingAuthSession = false;
  }
}

/**
 * Get the initialized Supabase client.
 * Throws if configureSupabase() hasn't been called yet.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      'Supabase client not configured. Call configureSupabase(anonKey) first.',
    );
  }
  return _supabase;
}

/** Returns the singleton when initialized without throwing during early startup. */
export function getSupabaseIfConfigured(): SupabaseClient | null {
  return _supabase;
}

/** Keep Supabase's token refresh loop scoped to foreground native usage. */
export async function syncSupabaseAuthAutoRefresh(
  status: AppStateStatus,
  platform: typeof Platform.OS = Platform.OS,
): Promise<void> {
  if (platform === 'web') return;

  const supabase = getSupabase();
  if (status === 'active') {
    await supabase.auth.startAutoRefresh();
    const { error } = await supabase.auth.getSession();
    if (error) throw error;
  } else {
    await supabase.auth.stopAutoRefresh();
  }
}
