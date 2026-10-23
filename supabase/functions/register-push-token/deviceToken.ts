import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

export async function releasePushDeviceToken(client: SupabaseClient, userId: string, token: string) {
  const { error } = await client.from("users")
    .update({ push_token: null, push_provider: null })
    .eq("id", userId)
    .eq("push_token", token);
  if (error) throw new Error(error.message);
}
