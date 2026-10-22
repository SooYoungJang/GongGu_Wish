import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  findDestructiveMigrations,
  findTablesMissingGrants,
} from "./production-migration-policy.mjs";

function fixture(contents) {
  const root = mkdtempSync(join(tmpdir(), "gonggu-migration-policy-"));
  const path = join(root, "migration.sql");
  writeFileSync(path, contents);
  return path;
}

test("accepts additive migrations", () => {
  const findings = findDestructiveMigrations([
    fixture("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS example text;"),
    fixture("ALTER TABLE public.users ADD COLUMN type text;"),
  ]);
  assert.deepEqual(findings, []);
});

test("accepts explicitly classified runtime deletes with a scoped WHERE clause", () => {
  const functionPath = fixture(`
CREATE FUNCTION public.remove_my_bookmark()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- production-migration-policy: allow-runtime-delete
  DELETE FROM public.account_bookmarks WHERE user_id = auth.uid();
END;
$$;
`);
  const retentionPath = fixture(`
SELECT cron.schedule('expire-events', '17 * * * *', $retention$
  -- production-migration-policy: allow-runtime-delete
  DELETE FROM public.events WHERE created_at < now() - interval '14 days';
$retention$);
`);
  assert.deepEqual(
    findDestructiveMigrations([functionPath, retentionPath]),
    [],
  );
});

test("does not let the runtime-delete marker hide unscoped or additional deletes", () => {
  const unscoped = fixture(`
-- production-migration-policy: allow-runtime-delete
DELETE FROM public.account_bookmarks;
`);
  const additional = fixture(`
-- production-migration-policy: allow-runtime-delete
DELETE FROM public.account_bookmarks WHERE user_id = auth.uid();
DELETE FROM public.users WHERE id = auth.uid();
`);

  assert.deepEqual(
    findDestructiveMigrations([unscoped, additional]).map(({ code }) => code),
    ["DELETE", "DELETE"],
  );
});

test("does not let the runtime-delete marker hide immediate migration deletes", () => {
  const topLevel = fixture(`
-- production-migration-policy: allow-runtime-delete
DELETE FROM public.users WHERE id = auth.uid();
`);
  const anonymousBlock = fixture(`
DO $$
BEGIN
  -- production-migration-policy: allow-runtime-delete
  DELETE FROM public.users WHERE id = auth.uid();
END;
$$;
`);

  assert.deepEqual(
    findDestructiveMigrations([topLevel, anonymousBlock]).map(
      ({ code }) => code,
    ),
    ["DELETE", "DELETE"],
  );
});

test("requires explicit approval for destructive migrations", () => {
  const path = fixture("ALTER TABLE public.users DROP COLUMN example;");
  assert.deepEqual(findDestructiveMigrations([path]), [
    { file: path, code: "DROP" },
  ]);
});

test("flags data deletion and type changes", () => {
  const findings = findDestructiveMigrations([
    fixture("DELETE FROM public.users WHERE id = 'test';"),
    fixture("ALTER TABLE public.users ALTER COLUMN value TYPE integer;"),
  ]);
  assert.deepEqual(
    findings.map(({ code }) => code),
    ["DELETE", "ALTER_TYPE"],
  );
});

test("requires a same-migration GRANT for every new public table", () => {
  const granted = fixture(`
CREATE TABLE IF NOT EXISTS public."wish_notes" (id uuid PRIMARY KEY);
ALTER TABLE public.wish_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.wish_notes TO anon, authenticated;
GRANT ALL ON public.wish_notes TO service_role;
`);
  const ungranted = fixture(`
CREATE TABLE public.wish_drafts (id uuid PRIMARY KEY);
CREATE TABLE public.wish (id uuid PRIMARY KEY);
GRANT ALL ON public.wish_drafts_archive TO service_role;
`);

  assert.deepEqual(findTablesMissingGrants([granted]), []);
  assert.deepEqual(
    findTablesMissingGrants([ungranted]).map(({ table }) => table),
    ["wish_drafts", "wish"],
  );
});

// Supabase no longer auto-grants new public tables from 2026-10-30, including
// db reset and preview branches, so new migrations must carry their own GRANTs.
test("migrations added from 2026-10-22 grant every public table they create", () => {
  const dir = "supabase/migrations";
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && name >= "20261022")
    .map((name) => join(dir, name));
  assert.deepEqual(findTablesMissingGrants(files), []);
});
