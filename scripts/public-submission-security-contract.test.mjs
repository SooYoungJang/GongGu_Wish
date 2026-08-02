import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260802000400_harden_public_submission_access.sql",
  "utf8",
);
const edgeFunction = readFileSync(
  "supabase/functions/public-submission/index.ts",
  "utf8",
);

test("public submission RLS removes anonymous write and read access", () => {
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "submissions_anon_insert"/,
  );
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "group_buys_anon_insert"/,
  );
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "group_buys_anon_update"/,
  );
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "submissions_public_read"/,
  );
  assert.match(migration, /CREATE POLICY "submissions_submitter_read"/);
  assert.match(
    migration,
    /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.gonggu_submissions\s+FROM\s+anon,\s*authenticated/s,
  );
  assert.match(
    migration,
    /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+public\.group_buys\s+FROM\s+anon,\s*authenticated/s,
  );
  assert.match(
    migration,
    /REVOKE\s+SELECT\s+ON\s+public\.gonggu_submissions\s+FROM\s+anon/s,
  );
});

test("public submission does not expose internal errors", () => {
  assert.match(edgeFunction, /return json\(\{ error: "internal_error" \}, 500\)/);
  assert.doesNotMatch(edgeFunction, /return json\(\{ error: message \}, 500\)/);
});
