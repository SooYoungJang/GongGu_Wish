import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

test("group-buy requests expose only bounded RPC contracts", () => {
  const migration = read(
    "supabase/migrations/20260801000001_add_group_buy_requests.sql",
  );

  assert.match(migration, /CREATE TABLE public\.group_buy_requests/);
  assert.match(
    migration,
    /CREATE TABLE public\.group_buy_request_participations/,
  );
  assert.match(
    migration,
    /CREATE TABLE public\.group_buy_request_attempt_limits/,
  );
  const limiterTable = migration.match(
    /CREATE TABLE public\.group_buy_request_attempt_limits \([\s\S]*?\n\);/,
  )?.[0];
  assert.ok(limiterTable);
  assert.match(limiterTable, /actor_hash bytea NOT NULL/);
  assert.doesNotMatch(limiterTable, /(?:user_id|session_id|ip_address)/);
  assert.match(migration, /session_hashes bytea\[\] NOT NULL/);
  assert.match(migration, /cardinality\(session_hashes\) BETWEEN 1 AND 8/);
  assert.match(migration, /ip_hash bytea NOT NULL/);
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.request_group_buy_internal\([\s\S]*?p_session_hash text[\s\S]*?p_ip_hash text[\s\S]*?p_user_id uuid/,
  );
  assert.doesNotMatch(migration, /auth\.uid\(\)/);
  assert.match(migration, /char_length\(v_product_name\) NOT BETWEEN 2 AND 60/);
  assert.match(migration, /\[\[:cntrl:\]\]/);
  assert.match(migration, /regexp_replace\([\s\S]*?\[\[:space:\]\]\+/);
  assert.match(migration, /lower\(v_product_name\)/);
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /pg_catalog\.statement_timestamp\(\)/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /v_recent_product_count >= 5/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /COUNT\(DISTINCT actor_key\) >= 2/);
  const accountReconciliation = migration.match(
    /IF p_user_id IS NOT NULL THEN[\s\S]*?END IF;\n\n  INSERT INTO public\.group_buy_requests/,
  )?.[0];
  assert.ok(accountReconciliation);
  assert.doesNotMatch(accountReconciliation, /participation\.ip_hash/);
  assert.equal(
    migration.match(/participation\.ip_hash = v_ip_hash/g)?.length,
    2,
  );
  assert.doesNotMatch(
    migration,
    /p_user_id IS NULL\s+AND participation\.ip_hash = v_ip_hash/,
  );
  const duplicatePersistenceUpdate = migration.match(
    /IF v_already_requested THEN[\s\S]*?\n  ELSE/,
  )?.[0];
  assert.ok(duplicatePersistenceUpdate);
  assert.doesNotMatch(duplicatePersistenceUpdate, /participation\.ip_hash/);
  assert.match(
    migration,
    /ORDER BY request_count DESC, latest_request_at DESC, request_id ASC/,
  );
  assert.match(
    migration,
    /LEAST\(GREATEST\(COALESCE\(p_limit_count, 3\), 1\), 3\)/,
  );

  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.consume_group_buy_request_attempt\(\s*p_actor_hash text\s*\)/,
  );
  assert.match(migration, /attempt_count <= 20/);
  assert.match(migration, /600::double precision/);
  assert.match(migration, /ON CONFLICT \(actor_hash, window_started_at\)/);
  assert.match(migration, /LEAST\(21, [^)]+attempt_count \+ 1\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /LIMIT 100/);
  assert.match(
    migration,
    /ORDER BY candidate\.window_started_at ASC, candidate\.actor_hash ASC[\s\S]*?FOR UPDATE SKIP LOCKED/,
  );

  assert.equal(migration.match(/SECURITY DEFINER/g)?.length, 3);
  assert.equal(migration.match(/SET search_path = pg_catalog/g)?.length, 3);
  assert.match(
    migration,
    /ALTER TABLE public\.group_buy_requests ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(
    migration,
    /ALTER TABLE public\.group_buy_request_participations ENABLE ROW LEVEL SECURITY/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.group_buy_requests FROM anon, authenticated/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.group_buy_request_participations FROM anon, authenticated/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.group_buy_request_attempt_limits FROM anon, authenticated/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.request_group_buy_internal\(text, text, text, uuid\) FROM PUBLIC/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.get_group_buy_request_rankings\(integer\) FROM PUBLIC/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.request_group_buy_internal\(text, text, text, uuid\) TO service_role/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.request_group_buy_internal[^\n]+TO (?:anon|authenticated)/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.consume_group_buy_request_attempt\(text\) TO service_role/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.consume_group_buy_request_attempt[^\n]+TO (?:anon|authenticated)/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_group_buy_request_rankings\(integer\) TO anon, authenticated/,
  );
});

test("group-buy request Edge intake owns trusted identity derivation", () => {
  const edgeFunction = read("supabase/functions/group-buy-request/index.ts");
  const mobileApi = read("apps/mobile/src/features/groupBuyRequests/api.ts");
  const integrationContract = read(
    "apps/mobile/src/integration/groupBuyRequest-contract.integration.test.ts",
  );
  const config = read("supabase/config.toml");

  assert.match(edgeFunction, /headers\.get\("cf-connecting-ip"\)/);
  assert.match(
    edgeFunction,
    /if \(isLocalSupabaseUrl\(supabaseUrl\)\) \{[\s\S]*return normalizeIp\(headers\.get\("cf-connecting-ip"\), false\);/,
  );
  assert.match(edgeFunction, /headers\.get\("x-forwarded-for"\)/);
  assert.ok(
    edgeFunction.indexOf('headers.get("x-forwarded-for")') <
      edgeFunction.indexOf('headers.get("x-real-ip")'),
  );
  assert.match(edgeFunction, /name: "HMAC", hash: "SHA-256"/);
  assert.match(edgeFunction, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(edgeFunction, /Deno\.env\.get\("SUPABASE_ANON_KEY"\)/);
  assert.match(
    edgeFunction,
    /isPublicAnonymousKey\(apikey, deps\.supabaseUrl\)/,
  );
  assert.match(edgeFunction, /"request_group_buy_internal"/);
  assert.match(edgeFunction, /"consume_group_buy_request_attempt"/);
  assert.ok(
    edgeFunction.indexOf('"consume_group_buy_request_attempt"') <
      edgeFunction.indexOf('"request_group_buy_internal"'),
  );
  assert.match(
    edgeFunction,
    /hmacSha256Hex\(\s*deps\.serviceRoleKey,\s*"user"/,
  );
  assert.match(edgeFunction, /"Retry-After": "600"/);
  assert.match(edgeFunction, /req\.body\?\.getReader\(\)/);
  assert.match(edgeFunction, /MAX_BODY_BYTES \+ 1 - totalBytes/);
  assert.match(edgeFunction, /reader\.cancel\(\)/);
  assert.doesNotMatch(edgeFunction, /req\.text\(\)/);
  assert.match(edgeFunction, /body\.product_name/);
  assert.match(edgeFunction, /body\.session_id/);
  assert.doesNotMatch(edgeFunction, /body\.(?:productName|sessionId)/);
  assert.match(edgeFunction, /p_user_id: userId/);
  assert.match(mobileApi, /functions\.invoke<unknown>\(\s*"group-buy-request"/);
  assert.match(mobileApi, /product_name: productName/);
  assert.match(mobileApi, /session_id: sessionId/);
  assert.doesNotMatch(mobileApi, /rpc\/request_group_buy/);
  assert.match(
    integrationContract,
    /body: \{ product_name: productName, session_id: sessionId \}/,
  );
  assert.doesNotMatch(
    integrationContract,
    /body:\s*\{\s*(?:productName|sessionId):/,
  );
  assert.match(
    config,
    /\[functions\.group-buy-request\][\s\S]*?verify_jwt = false/,
  );
});
