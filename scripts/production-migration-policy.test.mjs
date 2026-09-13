import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findDestructiveMigrations } from "./production-migration-policy.mjs";

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
