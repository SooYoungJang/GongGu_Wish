import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migration = read(
  "supabase/migrations/20260802000003_add_group_buy_influencer_profiles.sql",
);
const adminEdge = read("supabase/functions/admin-api/index.ts");

test("profile backfill trusts a reassigned current handle before raw-post fallback", () => {
  const currentHandleBackfill = migration.indexOf("WITH current_handles AS");
  const rawPostFallback = migration.indexOf(
    "Fall back to the raw-post owner only when the current account is missing",
  );

  assert.ok(currentHandleBackfill >= 0);
  assert.ok(rawPostFallback > currentHandleBackfill);
  assert.match(migration, /current_handle\.username <> 'unknown'/);
  assert.match(
    migration,
    /valid but unmatched reassigned account remains unlinked/,
  );
});

test("profile RPCs are service-only and serialize canonical ownership changes", () => {
  for (const functionName of [
    "upsert_influencer_profile",
    "update_group_buy_with_influencer_profile",
    "finalize_gonggu_submission_approval",
    "get_influencer_profiles_by_usernames",
  ]) {
    assert.match(migration, new RegExp(`FUNCTION public\\.${functionName}`));
  }

  assert.match(migration, /SECURITY DEFINER/g);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/g);
  assert.match(migration, /TO service_role/g);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /group-buy influencer changed concurrently/);
  assert.match(migration, /submission is no longer pending/);
  assert.match(migration, /v_username = 'unknown'/);
});

test("admin approval creates and links the group buy inside one transactional RPC", () => {
  assert.match(adminEdge, /"finalize_gonggu_submission_approval"/);
  assert.match(adminEdge, /"update_group_buy_with_influencer_profile"/);
  assert.match(migration, /INSERT INTO public\.group_buys/);
  assert.match(
    migration,
    /v_submission\.updated_at IS DISTINCT FROM p_expected_submission_updated_at/,
  );
  assert.doesNotMatch(adminEdge, /\.from\("group_buys"\)\s*\.insert/);
  assert.doesNotMatch(adminEdge, /\.update\(groupBuyPatch\)/);
  assert.doesNotMatch(adminEdge, /ensureInfluencerProfile/);
});
