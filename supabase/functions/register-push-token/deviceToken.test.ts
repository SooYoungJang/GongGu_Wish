import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { releasePushDeviceToken } from "./deviceToken.ts";

Deno.test("logout releases only the matching user and installation and preserves consent", async () => {
  const rows = [
    { id: "alice", push_token: "ExpoPushToken[this-device]", push_provider: "expo", push_enabled: true, marketing_push_enabled: true },
    { id: "bob", push_token: "ExpoPushToken[another-device]", push_provider: "expo", push_enabled: true, marketing_push_enabled: false },
  ];
  const client = { from: () => ({ update: (patch: Record<string, unknown>) => {
    const filters: Array<[string, string]> = [];
    const query = {
      eq(key: string, value: string) { filters.push([key, value]); return query; },
      then(resolve: (value: { error: null }) => void) {
        for (const row of rows) {
          if (filters.every(([key, value]) => row[key as keyof typeof row] === value)) Object.assign(row, patch);
        }
        resolve({ error: null });
      },
    };
    return query;
  } }) } as unknown as SupabaseClient;

  await releasePushDeviceToken(client, "alice", "ExpoPushToken[this-device]");
  assertEquals(rows[0].push_token, null);
  assertEquals(rows[0].push_enabled, true);
  assertEquals(rows[0].marketing_push_enabled, true);
  await releasePushDeviceToken(client, "bob", "ExpoPushToken[this-device]");
  assertEquals(rows[1].push_token, "ExpoPushToken[another-device]");
});
