import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
