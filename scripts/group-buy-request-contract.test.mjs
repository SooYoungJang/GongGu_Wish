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
  assert.match(migration, /session_hashes bytea\[\] NOT NULL/);
  assert.match(migration, /extensions\.digest\(/);
  assert.match(migration, /auth\.uid\(\)/);
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
  assert.match(
    migration,
    /ORDER BY request_count DESC, latest_request_at DESC, request_id ASC/,
  );
  assert.match(
    migration,
    /LEAST\(GREATEST\(COALESCE\(p_limit_count, 3\), 1\), 3\)/,
  );

  assert.equal(migration.match(/SECURITY DEFINER/g)?.length, 2);
  assert.equal(migration.match(/SET search_path = pg_catalog/g)?.length, 2);
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
    /REVOKE ALL ON FUNCTION public\.request_group_buy\(text, text\) FROM PUBLIC/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.get_group_buy_request_rankings\(integer\) FROM PUBLIC/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.request_group_buy\(text, text\) TO anon, authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_group_buy_request_rankings\(integer\) TO anon, authenticated/,
  );
});
