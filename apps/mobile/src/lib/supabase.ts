import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, type AppStateStatus } from 'react-native';

import { resolveSupabaseUrl } from './supabase-config';

let _supabase: SupabaseClient | null = null;

/**
 * Initialize the Supabase client with the anon key.
 * Must be called before any auth operations.
 */
export function configureSupabase(anonKey: string, supabaseUrl?: string): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(resolveSupabaseUrl(supabaseUrl), anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: AsyncStorage,
      },
    });
  }
  return _supabase;
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
