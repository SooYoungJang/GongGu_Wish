import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replace(
  /\r\n/g,
  "\n",
);
const supabaseContractsWorkflow = readFileSync(
  ".github/workflows/supabase-integration.yml",
  "utf8",
).replace(/\r\n/g, "\n");
const adminEnvironmentContract = readFileSync(
  "apps/admin/src/supabase/env.ts",
  "utf8",
);
const adminViteConfig = readFileSync("apps/admin/vite.config.ts", "utf8");

function job(jobId) {
  const marker = `  ${jobId}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${jobId} job is required`);

  const bodyStart = start + marker.length;
  const remaining = workflow.slice(bodyStart);
  const nextJob = remaining.search(/^  [a-z][a-z0-9-]*:\n/m);
  return nextJob === -1 ? remaining : remaining.slice(0, nextJob);
}

function missingCredentialGuard(jobId, firstVariable, secondVariable) {
  const body = job(jobId);
  const condition = `if [[ -z "$${firstVariable}" || -z "$${secondVariable}" ]]; then`;
  const start = body.indexOf(condition);
  assert.notEqual(start, -1, `${jobId} must validate its deployment secrets`);

  const end = body.indexOf("\n          fi", start);
  assert.notEqual(end, -1, `${jobId} credential guard must have a closing fi`);
  return body.slice(start, end);
}

test("missing Preview or Production deployment credentials fail closed", () => {
  const guards = [
    missingCredentialGuard(
      "supabase-db",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
    ),
    missingCredentialGuard(
      "deploy-worker",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
    ),
  ];

  for (const guard of guards) {
    assert.match(guard, /::error::/);
    assert.match(guard, /\bexit 1\b/);
    assert.doesNotMatch(guard, /deployment_enabled=false|::warning::|skipped/i);
  }
});

test("runtime clients never fall back to the Production Supabase project", () => {
  const productionProjectRef = "iosdoheblabfimkjnvfj";
  const runtimeClients = [
    "apps/api/src/supabase/supabase.service.ts",
    "apps/api/src/auth/supabase-jwt.strategy.ts",
    "packages/shared/src/utils/postgrest-client.ts",
  ];

  for (const file of runtimeClients) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      new RegExp(productionProjectRef),
      `${file} must require an explicit environment origin`,
    );
  }
});

test("the regular Supabase deployment syncs HIKER_API_KEY before hiker-lookup", () => {
  const functionsJob = job("supabase-functions");
  const syncIndex = functionsJob.indexOf(
    'supabase secrets set HIKER_API_KEY="$HIKER_API_KEY"',
  );
  const deployIndex = functionsJob.indexOf(
    "supabase functions deploy hiker-lookup",
  );

  assert.notEqual(
    syncIndex,
    -1,
    "the normal branch deployment must sync the Hiker secret",
  );
  assert.notEqual(deployIndex, -1, "hiker-lookup must be deployed");
  assert.ok(syncIndex < deployIndex, "the Hiker secret must be synced first");
  assert.match(
    functionsJob.slice(0, deployIndex),
    /HIKER_API_KEY:\s*\$\{\{\s*secrets\.HIKER_API_KEY\s*\}\}/,
  );
});

test("the Worker deploy waits for DB, RLS, and Edge Functions", () => {
  const workerJob = job("deploy-worker");
  const needs = workerJob.match(/^    needs:\s*\[([^\]]+)\]/m)?.[1] ?? "";

  assert.match(needs, /supabase-functions/);
  assert.match(workerJob, /needs\.supabase-functions\.result == 'success'/);
});

test("develop publishes a green same-SHA Preview release gate", () => {
  const releaseGate = job("preview-release-gate");
  const needs = releaseGate.match(/^    needs:\s*\[([^\]]+)\]/m)?.[1] ?? "";

  for (const dependency of [
    "supabase-db",
    "rls-audit",
    "supabase-functions",
    "deploy-worker",
    "deploy-mobile",
    "local-supabase-contracts",
  ]) {
    assert.match(needs, new RegExp(`\\b${dependency}\\b`));
  }
  assert.match(releaseGate, /refs\/heads\/develop/);
  assert.match(releaseGate, /github\.sha/);
  assert.match(releaseGate, /vercel/i);
  assert.match(releaseGate, /VERCEL_PREVIEW_DEPLOY_HOOK_URL/);
  assert.match(releaseGate, /integrations\/deploy/);
  assert.match(releaseGate, /prj_w8Jh6jcev9yQxWGeYvHMbEoRrro3/);
  assert.match(releaseGate, /preview[-_ ]green/i);
  assert.match(releaseGate, /release-identity\.json/);
  assert.match(releaseGate, /xwblovggtvbpiusjfokq/);
  assert.match(releaseGate, /GITHUB_SHA/);
  assert.match(
    releaseGate,
    /deployments\?sha=\$GITHUB_SHA&environment=Preview/,
  );
  assert.doesNotMatch(releaseGate, /deployments\?[^\n"]*&ref=develop/);
  assert.match(releaseGate, /\.ref == \$sha/);
  assert.match(releaseGate, /\.gitRef == "develop"/);
  assert.match(releaseGate, /http_code/);
  assert.match(releaseGate, /"200"/);
});

test("main pull requests require the latest develop Preview-green SHA", () => {
  const promotionGate = job("promotion-gate");

  assert.match(promotionGate, /github\.event_name == 'pull_request'/);
  assert.match(promotionGate, /github\.base_ref == 'main'/);
  assert.match(promotionGate, /develop/);
  assert.match(promotionGate, /preview[-_ ]green/i);
  assert.match(promotionGate, /head_sha/);
  assert.match(promotionGate, /github\.event\.pull_request\.head\.sha/);
  assert.match(promotionGate, /success/);
  assert.match(promotionGate, /compare\//);
  assert.match(promotionGate, /\.status/);
  assert.match(promotionGate, /\.tree\.sha/);
});

test("every develop SHA runs the complete Preview contract", () => {
  const pushTrigger = workflow.slice(
    workflow.indexOf("  push:\n"),
    workflow.indexOf("  pull_request:\n"),
  );

  assert.doesNotMatch(pushTrigger, /\n\s+paths:/);
  assert.match(workflow, /local-supabase-contracts:/);
  assert.match(
    workflow,
    /uses:\s*\.\/\.github\/workflows\/supabase-integration\.yml/,
  );
  assert.match(supabaseContractsWorkflow, /workflow_call:/);
});

test("Admin deployments publish an exact environment and commit identity", () => {
  assert.match(adminEnvironmentContract, /xwblovggtvbpiusjfokq/);
  assert.match(adminEnvironmentContract, /iosdoheblabfimkjnvfj/);
  assert.match(adminEnvironmentContract, /VITE_APP_ENV/);
  assert.match(adminEnvironmentContract, /VITE_COMMIT_SHA/);
  assert.match(adminEnvironmentContract, /VITE_GIT_REF/);
  assert.match(adminViteConfig, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(adminViteConfig, /VERCEL_GIT_COMMIT_REF/);
  assert.match(adminViteConfig, /release-identity\.json/);
});

test("Preview deployment credentials are denied Production targets", () => {
  const supabaseJob = job("supabase-db");
  const workerJob = job("deploy-worker");
  const credentialAudit = job("audit-preview-credentials");

  assert.match(supabaseJob, /api\.supabase\.com\/v1\/projects/);
  assert.match(supabaseJob, /iosdoheblabfimkjnvfj/);
  assert.match(supabaseJob, /expected.*inaccessible/is);
  assert.match(workerJob, /CLOUDFLARE_PREVIEW_DEPLOY_HOOK_URL/);
  assert.match(workerJob, /workers\/builds\/deploy_hooks/);
  assert.match(workerJob, /broad.*credential.*must not/is);
  assert.match(workerJob, /api-preview\.gongguwish\.com\/health/);
  assert.match(workerJob, /\.commitSha == \$sha/);
  assert.match(workerJob, /deploy:production/);
  assert.doesNotMatch(workerJob, /deploy:preview/);
  assert.match(
    job("deploy-hiker-lookup"),
    /Verify Supabase credential isolation/,
  );
  assert.match(credentialAudit, /Preview-only Supabase access/);
  assert.match(credentialAudit, /Preview-only Cloudflare deploy hook/);
  assert.match(credentialAudit, /CLOUDFLARE_PREVIEW_DEPLOY_HOOK_URL/);
  assert.match(credentialAudit, /Preview-only Vercel deploy hook/);
  assert.match(credentialAudit, /VERCEL_PREVIEW_DEPLOY_HOOK_URL/);
});
