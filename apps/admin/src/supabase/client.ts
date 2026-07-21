import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig(import.meta.env);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
