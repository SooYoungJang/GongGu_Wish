import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

export const adminRuntimeConfig = getSupabaseConfig({
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_COMMIT_SHA: import.meta.env.VITE_COMMIT_SHA,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

const { supabaseUrl, supabaseAnonKey } = adminRuntimeConfig;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
