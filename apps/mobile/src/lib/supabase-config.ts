export const DEFAULT_SUPABASE_URL = 'https://iosdoheblabfimkjnvfj.supabase.co';

/**
 * Resolve a Supabase origin once at app startup.
 * A trailing slash is removed so REST, Auth, and Edge paths share one format.
 */
export function resolveSupabaseUrl(supabaseUrl?: string): string {
  return (supabaseUrl?.trim() || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
}
