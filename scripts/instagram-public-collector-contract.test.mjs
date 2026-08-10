import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  path.join(root, ".github", "workflows", "instagram-public-collector.yml"),
  "utf8",
);
const secretSetup = readFileSync(
  path.join(
    root,
    "scripts",
    "configure-instagram-public-collector-secrets.ps1",
  ),
  "utf8",
);
const ciWorkflow = readFileSync(
  path.join(root, ".github", "workflows", "ci.yml"),
  "utf8",
).replace(/\r\n/g, "\n");

const productionSupabaseJob = ciWorkflow.slice(
  ciWorkflow.indexOf("  supabase-production:\n"),
  ciWorkflow.indexOf("\n  # ", ciWorkflow.indexOf("  supabase-production:\n") + 1),
);

test("remote collector is manual, Production-only, and latest-main guarded", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+schedule:/m);
  assert.match(
    workflow,
    /github\.ref == 'refs\/heads\/main' && inputs\.confirm_production == true/,
  );
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /Require the latest main commit/);
  assert.match(
    workflow,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/,
  );
});

test("remote collector requires masked Production secrets and existing write guards", () => {
  assert.match(workflow, /secrets\.INSTAGRAM_COLLECTOR_TOKEN/);
  assert.match(workflow, /secrets\.INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON/);
  assert.match(workflow, /INSTAGRAM_ALLOW_PRODUCTION_WRITES: "true"/);
  assert.match(workflow, /INSTAGRAM_PRODUCTION_PREFLIGHT_PASSED: "true"/);
  assert.match(workflow, /INSTAGRAM_PUBLIC_RUN_ONCE: "true"/);
  assert.match(workflow, /python public_main\.py/);
  assert.match(workflow, /playwright install --with-deps chromium/);
});

test("storageState validation accepts a UTF-8 BOM from Secret Manager", () => {
  assert.match(
    workflow,
    /state = json\.loads\(raw\.lstrip\(["']\\ufeff["']\)\)/,
  );
});

test("secret setup sends values through stdin instead of process arguments", () => {
  assert.match(secretSetup, /RedirectStandardInput = \$true/);
  assert.match(secretSetup, /StandardInput\.BaseStream\.Write/);
  assert.match(secretSetup, /EnvironmentVariableTarget\]::User/);
  assert.doesNotMatch(secretSetup, /--body\s+\$collectorToken/);
  assert.doesNotMatch(secretSetup, /Write-Output\s+\$collectorToken/);
});

test("Production Supabase deploy syncs the collector secret without logging its value", () => {
  assert.match(
    productionSupabaseJob,
    /name: Sync Production Instagram collector secret/,
  );
  assert.match(
    productionSupabaseJob,
    /INSTAGRAM_COLLECTOR_TOKEN:\s+\$\{\{ secrets\.INSTAGRAM_COLLECTOR_TOKEN \}\}/,
  );
  assert.match(productionSupabaseJob, /lstrip\("\\ufeff"\)/);
  assert.match(
    productionSupabaseJob,
    /supabase secrets set\s+\\\s+--env-file/,
  );
  assert.doesNotMatch(
    productionSupabaseJob,
    /echo\s+.*INSTAGRAM_COLLECTOR_TOKEN.*\$\{\{ secrets\./,
  );
});
