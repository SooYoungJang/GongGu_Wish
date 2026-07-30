import { supabaseDataProvider } from "ra-supabase-core";
import { adminRuntimeConfig, supabase } from "@/supabase/client";

const { supabaseUrl, supabaseAnonKey } = adminRuntimeConfig;

export const dataProvider = supabaseDataProvider({
  instanceUrl: supabaseUrl,
  apiKey: supabaseAnonKey,
  supabaseClient: supabase,
});
