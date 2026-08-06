import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReleaseManifest,
  listEdgeFunctionFiles,
  listMigrationFiles,
} from "./production-release-manifest.mjs";
import {
  buildMigrationHistoryPreflightSql,
  buildSchemaContractSql,
  listMigrationVersions,
  REQUIRED_FUNCTIONS,
  REQUIRED_USER_COLUMNS,
} from "./production-schema-contract.mjs";

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "gonggu-release-contract-"));
  mkdirSync(join(root, "supabase/migrations"), { recursive: true });
  mkdirSync(join(root, "supabase/functions/register-push-token"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "supabase/migrations/20260807000001_example.sql"),
    "select 1;",
  );
  writeFileSync(
    join(root, "supabase/functions/register-push-token/index.ts"),
    "export const handler = true;",
  );
  return root;
}

test("release manifest records source, migrations, functions, and mobile identity", () => {
  const root = fixtureRoot();
  const manifest = buildReleaseManifest({
    environment: "production",
    projectRef: "production-ref",
    sourceSha: "a".repeat(40),
    mobileDeployment: {
      mode: "ota",
      fingerprint: "fingerprint-1",
      runtimeVersion: "runtime-1",
    },
    workerSha: "b".repeat(40),
    root,
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.releaseId, `production:${"a".repeat(40)}`);
  assert.deepEqual(
    manifest.migrations.map(({ name }) => name),
    ["20260807000001_example.sql"],
  );
  assert.equal(manifest.edgeFunctions[0].name, "register-push-token");
  assert.equal(manifest.mobileDeployment.mode, "ota");
  assert.equal(manifest.workerSha, "b".repeat(40));
});

test("manifest file and function hashes change when release inputs change", () => {
  const root = fixtureRoot();
  const firstMigration = listMigrationFiles(join(root, "supabase/migrations"));
  const firstFunction = listEdgeFunctionFiles(join(root, "supabase/functions"));
  writeFileSync(
    join(root, "supabase/migrations/20260807000001_example.sql"),
    "select 2;",
  );
  writeFileSync(
    join(root, "supabase/functions/register-push-token/index.ts"),
    "export const handler = false;",
  );
  assert.notEqual(
    listMigrationFiles(join(root, "supabase/migrations"))[0].sha256,
    firstMigration[0].sha256,
  );
  assert.notEqual(
    listEdgeFunctionFiles(join(root, "supabase/functions"))[0].sha256,
    firstFunction[0].sha256,
  );
});

test("schema contract requires every current migration and notification dependency", () => {
  const sql = buildSchemaContractSql({
    migrationVersions: ["20260807000001", "20260807000002"],
  });
  for (const column of REQUIRED_USER_COLUMNS)
    assert.match(sql, new RegExp(column));
  for (const functionName of REQUIRED_FUNCTIONS) {
    assert.match(sql, new RegExp(functionName.replace(/[()[\],]/g, "\\$&")));
  }
  assert.match(sql, /20260807000001/);
  assert.match(sql, /20260807000002/);
  assert.match(sql, /missing migration versions/);
});

test("migration history preflight fails closed when the history is absent or empty", () => {
  const sql = buildMigrationHistoryPreflightSql();
  assert.match(sql, /migration history table is missing/);
  assert.match(sql, /migration history is empty/);
});

test("migration versions are derived in timestamp order", () => {
  const root = fixtureRoot();
  writeFileSync(
    join(root, "supabase/migrations/20260806000001_older.sql"),
    "select 1;",
  );
  assert.deepEqual(listMigrationVersions(join(root, "supabase/migrations")), [
    "20260806000001",
    "20260807000001",
  ]);
});
