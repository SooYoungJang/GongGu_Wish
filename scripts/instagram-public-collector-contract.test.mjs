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

test("Production collector restores cooldown before installing dependencies or collecting", () => {
  const guard = workflow.indexOf("- name: Restore and check Production collector cooldown");
  assert.ok(guard > 0);
  assert.ok(guard < workflow.indexOf("- name: Install collector dependencies"));
  assert.match(workflow, /actions: read/);
  for (const name of [
    "Install collector dependencies",
    "Validate required Production secrets",
    "Run collector unit tests and compile check",
    "Collect into Production",
  ]) {
    const step = workflow.slice(workflow.indexOf(`- name: ${name}`)).split(/\n\s+- name:/)[0];
    assert.match(step, /steps\.cooldown\.outputs\.allowed == 'true'/);
  }
  assert.match(workflow, /name: instagram-production-cooldown/);
  assert.match(workflow, /path: \$\{\{ env\.INSTAGRAM_PUBLIC_COOLDOWN_FILE \}\}/);
  assert.doesNotMatch(workflow, /echo ".*`\$(GITHUB_SHA|COLLECTION_MODE|COLLECT_OUTCOME)`/);
});

test("collector checks block affected Preview and Production release gates", () => {
  const collectorJob = ciWorkflow.slice(ciWorkflow.indexOf("  instagram-tests:\n"), ciWorkflow.indexOf("  worker-tests:\n"));
  assert.match(collectorJob, /outputs\.instagram_tests == 'true'/);
  assert.match(collectorJob, /python -m unittest discover/);
  assert.doesNotMatch(collectorJob, /environment:|secrets\./);
  for (const jobName of ["production-green", "preview-release-gate"]) {
    const body = ciWorkflow.slice(ciWorkflow.indexOf(`  ${jobName}:\n`)).split(/\n  # /)[0];
    assert.match(body, /instagram-tests,/);
    assert.match(body, /INSTAGRAM_REQUIRED: \$\{\{ needs\.change-plan\.outputs\.instagram_tests \}\}/);
    assert.match(body, /require_result "\$INSTAGRAM_REQUIRED" "Instagram collector tests" "\$INSTAGRAM_RESULT"/);
  }
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
