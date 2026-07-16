import { requireLocalSupabaseConfig } from "./localSupabaseHarness";

// The dedicated integration command must never report success by skipping the
// suite when its real local Supabase dependency was not started.
requireLocalSupabaseConfig();
