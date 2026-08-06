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
  ]);
  assert.deepEqual(findings, []);
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
