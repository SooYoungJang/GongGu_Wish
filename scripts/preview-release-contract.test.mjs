import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replace(
  /\r\n/g,
  "\n",
);
const supabaseContractsWorkflow = readFileSync(
  ".github/workflows/supabase-integration.yml",
  "utf8",
).replace(/\r\n/g, "\n");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const adminEnvironmentContract = readFileSync(
  "apps/admin/src/supabase/env.ts",
  "utf8",
);
const adminViteConfig = readFileSync("apps/admin/vite.config.ts", "utf8");
const adminVercelConfig = readFileSync("apps/admin/vercel.json", "utf8");
const adminIgnoreCommand = JSON.parse(adminVercelConfig).ignoreCommand;
const ciChangePlanSource = readFileSync("scripts/ci-change-plan.mjs", "utf8");
const mobileDeployScript = readFileSync(
  "apps/mobile/scripts/ci-deploy-android.sh",
  "utf8",
);
const previewBaselineSource = readFileSync(
  "apps/mobile/scripts/find-preview-runtime-baseline.mjs",
  "utf8",
);
const agentRules = readFileSync("AGENTS.md", "utf8");
const branchStrategy = readFileSync("docs/branch-strategy.md", "utf8");

function job(jobId) {
  const marker = `  ${jobId}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${jobId} job is required`);

  const bodyStart = start + marker.length;
  const remaining = workflow.slice(bodyStart);
  const nextJob = remaining.search(/^  [a-z][a-z0-9-]*:\n/m);
  return nextJob === -1 ? remaining : remaining.slice(0, nextJob);
}

function declaredNeeds(jobBody) {
  const inline = jobBody.match(/^    needs:\s*\[([^\]]*)\]/m)?.[1];
  const block = jobBody.match(/^    needs:\s*\n\s*\[([\s\S]*?)\n\s*\]/m)?.[1];
  return new Set(
    (inline ?? block ?? "")
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
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

test("missing Production deployment credentials fail closed", () => {
  const guards = [
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

test("hiker-lookup is declared for project-bound Git deployment", () => {
  assert.match(supabaseConfig, /^\[functions\.hiker-lookup\]$/m);
  assert.equal(existsSync("supabase/functions/hiker-lookup/index.ts"), true);
});

test("naver-userinfo accepts the upstream OAuth token without gateway JWT verification", () => {
  assert.match(
    supabaseConfig,
    /^\[functions\.naver-userinfo\]\r?\n(?:#[^\r\n]*\r?\n)*verify_jwt = false$/m,
  );
  assert.equal(existsSync("supabase/functions/naver-userinfo/index.ts"), true);
});

test("service_role can delete user profiles required by delete-account", () => {
  const deleteAccountSource = readFileSync(
    "supabase/functions/delete-account/index.ts",
    "utf8",
  );
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"));

  assert.match(
    deleteAccountSource,
    /\.from\(["']users["']\)\.delete\(\)/,
    "delete-account must delete the authenticated user's public profile",
  );

  const userServiceRoleDeleteGrants = migrations
    .flatMap(
      (migration) =>
        migration.replace(/--.*$/gm, "").match(/\bGRANT\b[^;]*;/gi) ?? [],
    )
    .map((grant) => grant.replace(/\s+/g, " ").trim())
    .filter(
      (grant) =>
        /\b(?:DELETE|ALL(?:\s+PRIVILEGES)?)\b/i.test(grant) &&
        /\bON\b[^;]*\bpublic\s*\.\s*users\b[^;]*\bTO\s+service_role\b/i.test(
          grant,
        ),
    );
  assert.deepEqual(
    userServiceRoleDeleteGrants,
    ["GRANT DELETE ON TABLE public.users TO service_role;"],
    "delete-account must receive only the required public.users DELETE grant",
  );
});

test("Auth users are provisioned and backfilled without overwriting public profiles", () => {
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"));
  const provisioningMigration = migrations.find((migration) =>
    /\bAFTER\s+INSERT\s+ON\s+auth\s*\.\s*users\b/i.test(
      migration.replace(/--.*$/gm, ""),
    ),
  );

  assert.ok(
    provisioningMigration,
    "a migration must provision public.users from an auth.users AFTER INSERT trigger",
  );

  const normalized = provisioningMigration
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ");
  assert.match(
    normalized,
    /\bINSERT\s+INTO\s+public\s*\.\s*users\b/i,
    "the Auth trigger must insert the corresponding public.users profile",
  );
  assert.match(
    normalized,
    /\bFROM\s+auth\s*\.\s*users\b/i,
    "the migration must backfill profiles for existing Auth users",
  );
  assert.match(
    normalized,
    /\braw_user_meta_data\b/i,
    "profile provisioning must preserve signup and social-provider metadata",
  );
  assert.match(
    normalized,
    /\bSECURITY\s+DEFINER\b/i,
    "the Auth trigger function must use the privileges required to insert a profile",
  );
  assert.match(
    normalized,
    /\bSET\s+search_path\s*=\s*''/i,
    "the security-definer function must use an empty search_path",
  );
  assert.match(
    normalized,
    /\bREVOKE\s+ALL\s+ON\s+FUNCTION\b/i,
    "the trigger function must not be directly executable by API roles",
  );

  const conflictSafeInserts =
    normalized.match(/\bON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING\b/gi) ?? [];
  assert.ok(
    conflictSafeInserts.length >= 2,
    "both trigger provisioning and backfill must preserve existing public.users rows",
  );
});

test("the Worker deploy waits for the branch-specific Supabase gate", () => {
  const workerJob = job("deploy-worker");
  const needs = workerJob.match(/^    needs:\s*\[([^\]]+)\]/m)?.[1] ?? "";

  assert.match(needs, /supabase-production/);
  assert.match(needs, /supabase-preview/);
  assert.match(workerJob, /needs\.supabase-production\.result == 'success'/);
  assert.match(workerJob, /needs\.supabase-preview\.result == 'success'/);
  assert.match(workerJob, /refs\/heads\/main/);
  assert.match(workerJob, /refs\/heads\/develop/);
});

test("JavaScript Worker deploys do not depend on a custom tsconfig", () => {
  for (const file of [
    "workers/api-proxy/wrangler.jsonc",
    "workers/api-proxy/wrangler.preview.jsonc",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /"tsconfig"\s*:/,
      `${file} must not require Wrangler to resolve a custom tsconfig`,
    );
  }
});

test("develop publishes a green affected-components Preview release gate", () => {
  const releaseGate = job("preview-release-gate");
  const needs =
    releaseGate.match(/^    needs:\s*\n\s*\[([\s\S]*?)\n\s*\]/m)?.[1] ?? "";

  for (const dependency of [
    "change-plan",
    "supabase-preview",
    "worker-tests",
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
  assert.match(releaseGate, /deployments\?sha=\$GITHUB_SHA&per_page=100/);
  assert.doesNotMatch(releaseGate, /environment=preview/);
  assert.match(releaseGate, /\.ref == \$sha/);
  assert.match(releaseGate, /\.gitRef == "develop"/);
  assert.match(releaseGate, /http_code/);
  assert.match(releaseGate, /"200"/);
  assert.match(releaseGate, /needs\.change-plan\.outputs\.admin == 'true'/);
  assert.match(releaseGate, /needs\.change-plan\.outputs\.supabase == 'true'/);
  assert.match(releaseGate, /needs\.change-plan\.outputs\.worker == 'true'/);
  assert.match(releaseGate, /affected:/);
  assert.match(releaseGate, /docsOnly:/);
  assert.match(releaseGate, /unchanged components were reused/);
});

test("Preview mobile deploys use successful GitHub APK baselines before EAS OTA", () => {
  const mobileJob = job("deploy-mobile");
  const releaseGate = job("preview-release-gate");

  assert.match(workflow, /permissions:\n\s+actions: read\n\s+contents: read/);
  assert.match(mobileJob, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.match(mobileJob, /artifact-name:/);
  assert.match(mobileJob, /steps\.mobile-deploy\.outputs\.artifact-name/);
  assert.match(mobileJob, /apk-artifact-id:/);
  assert.match(mobileJob, /steps\.upload-apk\.outputs\.artifact-id/);
  assert.match(mobileJob, /apk-artifact-url:/);
  assert.match(mobileJob, /steps\.upload-apk\.outputs\.artifact-url/);
  assert.match(mobileJob, /apk-sha256:/);
  const uploadArtifactStep = mobileJob.match(
    /- name: Upload local APK artifact[\s\S]*?(?=\n\s+- name: Report local APK artifact)/,
  )?.[0];
  assert.ok(uploadArtifactStep, "local APK artifact upload step is required");
  assert.match(
    uploadArtifactStep,
    /if:\s*\$\{\{\s*always\(\)\s*&&\s*steps\.mobile-deploy\.outputs\.mode\s*==\s*'build'\s*\}\}/,
  );
  assert.match(
    uploadArtifactStep,
    /path:\s*\$\{\{\s*steps\.mobile-deploy\.outputs\.apk-path\s*\}\}/,
  );
  assert.match(
    uploadArtifactStep,
    /name:\s*\$\{\{\s*steps\.mobile-deploy\.outputs\.artifact-name\s*\}\}/,
  );
  assert.match(uploadArtifactStep, /if-no-files-found:\s*error/);
  assert.doesNotMatch(uploadArtifactStep, /continue-on-error/);
  const mobileDeployStep = mobileJob.match(
    /- name: Run fingerprint-aware local Android deployment[\s\S]*?(?=\n\s+- name: Upload local APK artifact)/,
  )?.[0];
  assert.ok(mobileDeployStep, "mobile deployment step is required");
  assert.doesNotMatch(mobileDeployStep, /continue-on-error/);
  const reportArtifactStep = mobileJob.match(
    /- name: Report local APK artifact[\s\S]*?(?=\n\s{2}#|$)/,
  )?.[0];
  assert.ok(reportArtifactStep, "local APK report step is required");
  assert.doesNotMatch(reportArtifactStep, /always\(\)/);
  assert.match(
    mobileDeployScript,
    /This account has used its local builds from the free plan this month/,
  );
  assert.match(mobileDeployScript, /will reset/);
  assert.match(mobileDeployScript, /eas_registration="quota-exhausted"/);
  assert.match(mobileDeployScript, /eas-registration=\$eas_registration/);
  assert.match(mobileDeployScript, /OTA baseline was not registered/);
  assert.match(mobileDeployScript, /find-preview-runtime-baseline\.mjs/);
  assert.match(mobileDeployScript, /GitHub Actions artifact only/);
  assert.match(previewBaselineSource, /actions\/workflows\/ci\.yml/);
  assert.match(
    previewBaselineSource,
    /run\?\.path === "\.github\/workflows\/ci\.yml"/,
  );
  assert.match(previewBaselineSource, /run\?\.conclusion === "success"/);
  assert.match(previewBaselineSource, /run\?\.event === "push"/);
  assert.match(previewBaselineSource, /run\?\.head_branch === "develop"/);
  assert.match(previewBaselineSource, /manifest\?\.mode === "build"/);
  assert.match(previewBaselineSource, /manifest\?\.apkSha256/);
  assert.match(previewBaselineSource, /artifact\?\.expired === false/);
  assert.match(previewBaselineSource, /artifact\.size_in_bytes > 0/);
  assert.match(releaseGate, /MOBILE_DEPLOY_MODE/);
  assert.match(releaseGate, /MOBILE_FINGERPRINT/);
  assert.match(releaseGate, /MOBILE_ARTIFACT_NAME/);
  assert.match(releaseGate, /MOBILE_ARTIFACT_ID/);
  assert.match(releaseGate, /MOBILE_APK_SHA256/);
  assert.match(releaseGate, /mobileDeployment:/);
  assert.match(releaseGate, /preview-runtime-baseline\.json/);
  assert.match(releaseGate, /mode: "build"/);
});

test("Preview Green summary renders the SHA without shell command substitution", () => {
  const releaseGate = job("preview-release-gate");

  assert.doesNotMatch(
    releaseGate,
    /echo\s+"[^"\n]*`\$\{\{\s*github\.sha\s*\}\}`[^"\n]*"/,
  );
  assert.match(
    releaseGate,
    /printf\s+'All affected Preview checks[^'\n]*`%s`[^'\n]*\\n'\s+"\$\{\{\s*github\.sha\s*\}\}"/,
  );
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

test("follow-up promotions allow diverged history only when the merge tree is unchanged", () => {
  const promotionGate = job("promotion-gate");
  const compareIndex = promotionGate.indexOf("compare_status=");
  const mergeTreeIndex = promotionGate.indexOf("merge_tree=");

  assert.notEqual(compareIndex, -1);
  assert.notEqual(mergeTreeIndex, -1);
  assert.ok(compareIndex < mergeTreeIndex);
  assert.match(promotionGate, /ahead\|identical\|diverged/);
  assert.match(promotionGate, /merge_tree.*!=.*head_tree/);
  assert.match(
    promotionGate,
    /tested PR merge tree differs from the Preview-green develop tree/,
  );
});

test("promotion waits for the exact develop Preview Green without hiding failures", () => {
  const promotionGate = job("promotion-gate");

  assert.match(promotionGate, /timeout-minutes:\s*15/);
  assert.match(promotionGate, /for attempt in \{1\.\.40\}/);
  assert.match(promotionGate, /\.head_sha == \$sha/);
  assert.match(promotionGate, /run_status.*== "completed"/);
  assert.match(promotionGate, /preview_status.*== "completed"/);
  assert.match(promotionGate, /preview_conclusion.*== "success"/);
  assert.match(promotionGate, /\.name == "Preview Green"/);
  assert.match(promotionGate, /sleep 15/);
  assert.match(
    promotionGate,
    /develop workflow for .* concluded with .*Preview Green/,
  );
});

test("every develop SHA runs a lightweight change plan and Preview gate", () => {
  const pushTrigger = workflow.slice(
    workflow.indexOf("  push:\n"),
    workflow.indexOf("  pull_request:\n"),
  );
  const changePlan = job("change-plan");
  const releaseGate = job("preview-release-gate");

  assert.doesNotMatch(pushTrigger, /\n\s+paths:/);
  assert.match(changePlan, /ci-change-plan\.mjs/);
  assert.match(changePlan, /ci-change-plan\.test\.mjs/);
  assert.match(changePlan, /preview-release-contract\.test\.mjs/);
  assert.match(changePlan, /github\.event\.pull_request\.base\.sha/);
  assert.match(changePlan, /github\.event\.pull_request\.head\.sha/);
  assert.match(changePlan, /git merge-base/);
  assert.match(changePlan, /github\.event\.before/);
  assert.match(releaseGate, /always\(\)/);
  assert.match(releaseGate, /refs\/heads\/develop/);
  assert.match(releaseGate, /needs\.change-plan\.result/);
  assert.match(releaseGate, /Require every affected Preview component/);
});

test("heavy jobs are conditional on their affected component", () => {
  const expectations = {
    lint: "quality",
    build: "build",
    test: "test",
    "api-tests": "api",
    "edge-tests": "edge_tests",
    "local-supabase-contracts": "local_supabase",
    "supabase-preview": "supabase",
    "worker-tests": "worker_tests",
    "deploy-worker": "worker",
    "deploy-mobile": "mobile",
  };

  for (const [jobId, output] of Object.entries(expectations)) {
    const body = job(jobId);
    assert.match(body, /change-plan/);
    assert.match(
      body,
      new RegExp(`needs\\.change-plan\\.outputs\\.${output}`),
      `${jobId} must use the ${output} change-plan output`,
    );
  }
});

test("change planning includes deletions and both sides of renames", () => {
  const changePlan = job("change-plan");

  assert.match(changePlan, /git diff --no-renames --name-only/);
  assert.doesNotMatch(changePlan, /--diff-filter=ACMR/);
  assert.match(ciChangePlanSource, /execFileSync\(\s*"git"/);
  assert.match(ciChangePlanSource, /"--no-renames"/);
  assert.match(ciChangePlanSource, /"--name-only"/);
});

test("Admin builds fail safe when Vercel has no previous successful SHA", () => {
  assert.equal(
    adminIgnoreCommand,
    "node ../../scripts/ci-change-plan.mjs --vercel-admin",
  );
  assert.ok(adminIgnoreCommand.length <= 256);
  assert.match(ciChangePlanSource, /VERCEL_GIT_PREVIOUS_SHA/);
  assert.match(ciChangePlanSource, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(ciChangePlanSource, /process\.exitCode = 1/);
});

test("PostgreSQL starts only for API tests", () => {
  const workspaceTests = job("test");
  const apiTests = job("api-tests");

  assert.doesNotMatch(workspaceTests, /services:\s*\n\s*postgres:/);
  assert.match(apiTests, /services:\s*\n\s*postgres:/);
  assert.match(apiTests, /--filter=@gonggu\/api/);
});

test("workspace filters cross the expression boundary through environment data", () => {
  const outputByJob = {
    lint: "workspace_filters",
    build: "workspace_filters",
    test: "workspace_test_filters",
  };

  for (const [jobId, output] of Object.entries(outputByJob)) {
    const body = job(jobId);
    assert.match(
      body,
      new RegExp(
        `WORKSPACE_FILTERS:\\s*\\$\\{\\{ needs\\.change-plan\\.outputs\\.${output} \\}\\}`,
      ),
    );
    assert.doesNotMatch(
      body,
      /run:\s+npm (?:run )?\w+ -- \$\{\{ needs\.change-plan\.outputs\.workspace_filters \}\}/,
    );
  }
});

test("every needs context reference declares its job dependency", () => {
  const jobIds = Array.from(
    workflow.matchAll(/^  ([A-Za-z][A-Za-z0-9_-]*):\n/gm),
    (match) => match[1],
  );

  for (const jobId of jobIds) {
    const body = job(jobId);
    const dependencies = declaredNeeds(body);
    for (const match of body.matchAll(/needs\.([A-Za-z][A-Za-z0-9_-]*)/g)) {
      assert.ok(
        dependencies.has(match[1]),
        `${jobId} references needs.${match[1]} without declaring it`,
      );
    }
  }
});

test("Production jobs use component-specific main promotion conditions", () => {
  assert.match(job("supabase-production"), /outputs\.supabase == 'true'/);
  assert.match(job("deploy-worker"), /outputs\.worker == 'true'/);
  assert.match(job("deploy-mobile"), /outputs\.mobile == 'true'/);
});

test("repository rules require affected-only CI and documentation no-op releases", () => {
  for (const document of [agentRules, branchStrategy]) {
    assert.match(document, /문서-only|Markdown-only/i);
    assert.match(document, /affected|영향/);
    assert.match(document, /develop.*main|develop → main/s);
  }
  assert.match(agentRules, /앱·DB·API를 빌드하거나 배포하지 않는다/);
  assert.match(branchStrategy, /without rebuilding Production applications/);
});

test("repository rules persist the solo-collaborator merge authorization model", () => {
  assert.match(
    agentRules,
    /`develop`과 `main`의 필수 사람 승인 수는 모두 0으로 유지한다/,
  );
  assert.match(
    agentRules,
    /현재 요청에서 “프로덕션 배포해” 또는 “main에 올려”라고 명시한 경우에만/,
  );
  assert.match(agentRules, /관리자 우회나 강제 머지는 사용하지 않는다/);
  assert.match(
    branchStrategy,
    /both `develop` and `main` require zero\s+human GitHub approvals/,
  );
  assert.match(branchStrategy, /explicit Production request/);
  assert.match(branchStrategy, /Preview Promotion Gate/);
});

test("manual Preview operations never trigger the full deployment pipeline", () => {
  for (const jobId of [
    "supabase-preview",
    "supabase-production",
    "deploy-worker",
    "deploy-mobile",
    "preview-release-gate",
  ]) {
    assert.match(
      job(jobId),
      /github\.event_name == 'push'/,
      `${jobId} must deploy only for branch push events`,
    );
  }
});

test("manual Preview APK recovery is explicit, develop-only, and never targets Production", () => {
  const recoveryJob = job("preview-apk-recovery");

  assert.match(workflow, /workflow_dispatch:[\s\S]*confirm_preview_build:/);
  assert.match(workflow, /confirm_preview_build:[\s\S]*type:\s*boolean/);
  assert.match(workflow, /confirm_preview_build:[\s\S]*default:\s*false/);
  assert.match(recoveryJob, /github\.ref == 'refs\/heads\/develop'/);
  assert.match(recoveryJob, /inputs\.confirm_preview_build == true/);
  assert.match(recoveryJob, /environment:\s*preview/);
  assert.match(recoveryJob, /Require the latest develop commit/);
  assert.match(recoveryJob, /GITHUB_SHA.*develop_sha/);
  assert.match(recoveryJob, /FORCE_PREVIEW_APK:\s*"true"/);
  assert.match(recoveryJob, /ci-deploy-android\.sh/);
  assert.match(recoveryJob, /Require a local Preview APK result/);
  assert.match(
    recoveryJob,
    /DEPLOY_MODE:\s*\$\{\{ steps\.mobile-build\.outputs\.mode \}\}/,
  );
  assert.match(
    recoveryJob,
    /APK_PATH:\s*\$\{\{ steps\.mobile-build\.outputs\.apk-path \}\}/,
  );
  assert.equal(
    recoveryJob.match(/git\/ref\/heads\/develop/g)?.length,
    2,
    "the recovery build must reject develop moving before or during the build",
  );
  assert.match(recoveryJob, /actions\/upload-artifact@/);
  assert.doesNotMatch(recoveryJob, /refs\/heads\/main/);
  assert.doesNotMatch(recoveryJob, /environment:\s*production/);
  assert.match(mobileDeployScript, /FORCE_PREVIEW_APK must be true or false/);
  assert.match(
    mobileDeployScript,
    /FORCE_PREVIEW_APK is restricted to the Preview environment/,
  );
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
  assert.match(adminVercelConfig, /"ignoreCommand"/);
  assert.match(adminIgnoreCommand, /--vercel-admin/);
  assert.match(adminIgnoreCommand, /ci-change-plan\.mjs/);
  assert.match(adminIgnoreCommand, /--vercel-admin/);
});

test("Vercel Web skips builds when its workspace is unaffected", () => {
  const webVercelPath = "apps/web/vercel.json";

  assert.equal(existsSync(webVercelPath), true, "Web needs a Vercel config");
  const webVercelConfig = JSON.parse(readFileSync(webVercelPath, "utf8"));
  assert.equal(
    webVercelConfig.ignoreCommand,
    "node ../../scripts/ci-change-plan.mjs --vercel-web",
  );
  assert.match(ciChangePlanSource, /--vercel-web/);
  assert.match(ciChangePlanSource, /shouldBuildVercelProject/);
});

test("project-bound Supabase deployments are isolated by exact project URL", () => {
  const previewIntegration = job("supabase-preview");
  const productionIntegration = job("supabase-production");
  const workerJob = job("deploy-worker");
  const credentialAudit = job("audit-preview-credentials");

  assert.match(previewIntegration, /xwblovggtvbpiusjfokq/);
  assert.doesNotMatch(previewIntegration, /iosdoheblabfimkjnvfj/);
  assert.match(productionIntegration, /iosdoheblabfimkjnvfj/);
  assert.doesNotMatch(productionIntegration, /xwblovggtvbpiusjfokq/);
  assert.doesNotMatch(previewIntegration, /SUPABASE_ACCESS_TOKEN/);
  assert.doesNotMatch(productionIntegration, /SUPABASE_ACCESS_TOKEN/);
  assert.doesNotMatch(workerJob, /CLOUDFLARE_PREVIEW_DEPLOY_HOOK_URL/);
  assert.doesNotMatch(workerJob, /workers\/builds\/deploy_hooks/);
  assert.match(workerJob, /broad.*credential.*must not/is);
  assert.match(workerJob, /api-preview\.gongguwish\.com\/health/);
  assert.match(workerJob, /\.commitSha == \$sha/);
  assert.match(workerJob, /deploy:production/);
  assert.doesNotMatch(workerJob, /deploy:preview/);
  assert.match(
    credentialAudit,
    /Reject broad Supabase account credentials in Preview/,
  );
  assert.match(credentialAudit, /SUPABASE_ACCESS_TOKEN must not be configured/);
  assert.doesNotMatch(credentialAudit, /api\.supabase\.com\/v1\/projects/);
  assert.match(
    credentialAudit,
    /Reject broad Cloudflare account credentials in Preview/,
  );
  assert.doesNotMatch(credentialAudit, /CLOUDFLARE_PREVIEW_DEPLOY_HOOK_URL/);
  assert.match(credentialAudit, /Preview-only Vercel deploy hook/);
  assert.match(credentialAudit, /VERCEL_PREVIEW_DEPLOY_HOOK_URL/);
});

test("CI bundle-checks every Edge Function entrypoint", () => {
  const edgeTests = job("edge-tests");

  assert.match(edgeTests, /supabase\/functions\/\*\/index\.ts/);
  assert.match(edgeTests, /deno check "\$entrypoint"/);
});

test("develop observes the project-bound Cloudflare Git build without retriggering it", () => {
  const workerJob = job("deploy-worker");

  assert.doesNotMatch(workerJob, /Trigger Preview Worker build/);
  assert.doesNotMatch(workerJob, /CLOUDFLARE_PREVIEW_DEPLOY_HOOK_URL/);
  assert.match(workerJob, /Require exact Preview Worker deployment/);
  assert.match(workerJob, /api-preview\.gongguwish\.com\/health/);
  assert.match(workerJob, /\.commitSha == \$sha/);
  assert.match(workerJob, /\.supabaseProjectRef == "xwblovggtvbpiusjfokq"/);
});

test("Preview release gate discovers the exact-SHA Vercel Admin deployment", () => {
  const releaseGate = job("preview-release-gate");

  assert.match(releaseGate, /deployments\?sha=\$GITHUB_SHA&per_page=100/);
  assert.doesNotMatch(releaseGate, /environment=preview/);
  assert.match(releaseGate, /\.sha == \$sha/);
  assert.match(releaseGate, /\.ref == \$sha/);
  assert.match(releaseGate, /\.environment == "Preview – gong-gu-wish-admin"/);
  assert.match(releaseGate, /\.creator\.login == "vercel\[bot\]"/);
  assert.match(releaseGate, /\.state == "success"/);
  assert.match(releaseGate, /test\("\^https:\/\/gong-gu-wish-admin-/);
  assert.match(releaseGate, /-jsy10835/);
  assert.doesNotMatch(releaseGate, /\.creator\.login == \$owner/);
  assert.doesNotMatch(releaseGate, /--jq '\.\[0\]\.state/);
});

test("local Supabase contracts reject public tables without RLS", () => {
  assert.match(supabaseContractsWorkflow, /rowsecurity = false/);
  assert.match(supabaseContractsWorkflow, /RLS disabled on:/);
  assert.match(supabaseContractsWorkflow, /supabase db query/);
});

test("local Supabase boots every Edge Function before Preview deployment", () => {
  assert.match(
    supabaseContractsWorkflow,
    /for entrypoint in supabase\/functions\/\*\/index\.ts/,
  );
  assert.match(supabaseContractsWorkflow, /\/functions\/v1\/\$function_name/);
  assert.match(supabaseContractsWorkflow, /BOOT_ERROR/);
  assert.match(supabaseContractsWorkflow, /Failed to boot \$function_name/);
});

test("every configured Edge Function has a real entrypoint", () => {
  const configuredFunctions = [
    ...supabaseConfig.matchAll(/^\[functions\.([^\]]+)\]$/gm),
  ].map((match) => match[1]);

  for (const functionName of configuredFunctions) {
    assert.equal(
      existsSync(`supabase/functions/${functionName}/index.ts`),
      true,
      `${functionName} is configured without supabase/functions/${functionName}/index.ts`,
    );
  }
});

test("every Edge Function entrypoint is configured for Git deployment", () => {
  const configuredFunctions = new Set(
    [...supabaseConfig.matchAll(/^\[functions\.([^\]]+)\]$/gm)].map(
      (match) => match[1],
    ),
  );
  const functionDirectories = readdirSync("supabase/functions", {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(`supabase/functions/${entry.name}/index.ts`),
    )
    .map((entry) => entry.name);

  for (const functionName of functionDirectories) {
    assert.equal(
      configuredFunctions.has(functionName),
      true,
      `${functionName} has an entrypoint but is missing from supabase/config.toml`,
    );
  }
});

test("develop delegates Supabase deployment to the exact Preview integration", () => {
  const previewIntegration = job("supabase-preview");

  assert.match(previewIntegration, /github\.ref == 'refs\/heads\/develop'/);
  assert.match(previewIntegration, /commits\/\$GITHUB_SHA\/check-runs/);
  assert.match(previewIntegration, /\.app\.slug == "supabase"/);
  assert.match(previewIntegration, /\.name == "Supabase Preview"/);
  assert.match(previewIntegration, /xwblovggtvbpiusjfokq/);
  assert.match(previewIntegration, /\.conclusion == "success"/);
  assert.match(previewIntegration, /GH_TOKEN:\s*\$\{\{ github\.token \}\}/);
  assert.doesNotMatch(previewIntegration, /SUPABASE_ACCESS_TOKEN/);

  const productionIntegration = job("supabase-production");
  assert.match(productionIntegration, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(productionIntegration, /refs\/heads\/develop/);

  for (const consumer of [
    "deploy-worker",
    "deploy-mobile",
    "preview-release-gate",
  ]) {
    assert.match(job(consumer), /supabase-preview/);
  }
});

test("Production delegates Supabase deployment to the exact project integration", () => {
  const productionIntegration = job("supabase-production");

  assert.match(productionIntegration, /environment:\s*production/);
  assert.match(productionIntegration, /github\.ref == 'refs\/heads\/main'/);
  assert.match(productionIntegration, /outputs\.supabase == 'true'/);
  assert.match(productionIntegration, /commits\/\$GITHUB_SHA\/check-runs/);
  assert.match(productionIntegration, /\.head_sha == \$sha/);
  assert.match(productionIntegration, /\.app\.slug == "supabase"/);
  assert.match(productionIntegration, /\.name == "Supabase Preview"/);
  assert.match(productionIntegration, /iosdoheblabfimkjnvfj/);
  assert.match(productionIntegration, /\.conclusion == "success"/);
  assert.equal(
    productionIntegration.match(/GH_TOKEN:\s*\$\{\{ github\.token \}\}/g)
      ?.length,
    2,
    "Production check and recovery guard both require GitHub API auth",
  );

  for (const forbidden of [
    /SUPABASE_ACCESS_TOKEN/,
    /SUPABASE_DB_PASSWORD/,
    /supabase\/setup-cli/,
    /supabase link/,
    /supabase db push/,
    /supabase functions deploy/,
    /supabase secrets set/,
  ]) {
    assert.doesNotMatch(productionIntegration, forbidden);
  }

  for (const removedJob of ["supabase-db", "rls-audit", "supabase-functions"]) {
    assert.doesNotMatch(workflow, new RegExp(`^  ${removedJob}:`, "m"));
  }

  for (const consumer of ["deploy-worker", "deploy-mobile"]) {
    const body = job(consumer);
    assert.match(body, /supabase-production/);
    assert.match(body, /needs\.supabase-production\.result == 'success'/);
  }
});

test("Production recovery is explicit, main-only, and reuses every deployment gate", () => {
  assert.match(
    workflow,
    /confirm_production_recovery:[\s\S]*type:\s*boolean[\s\S]*default:\s*false/,
  );

  const changePlan = job("change-plan");
  assert.match(changePlan, /--production-recovery/);
  assert.match(changePlan, /inputs\.confirm_production_recovery/);
  assert.match(changePlan, /github\.ref == 'refs\/heads\/main'/);

  for (const jobId of [
    "supabase-production",
    "deploy-worker",
    "deploy-mobile",
  ]) {
    const body = job(jobId);
    assert.match(body, /github\.event_name == 'workflow_dispatch'/);
    assert.match(body, /inputs\.confirm_production_recovery == true/);
    assert.match(body, /git\/ref\/heads\/main/);
    assert.match(body, /GITHUB_SHA/);
  }

  assert.doesNotMatch(job("supabase-preview"), /confirm_production_recovery/);
  assert.doesNotMatch(
    job("preview-release-gate"),
    /confirm_production_recovery/,
  );
});

test("Kakao provider readiness is public, environment-exact, and release-blocking", () => {
  const providerJob = job("kakao-provider-ready");
  assert.match(providerJob, /name:\s*Kakao Auth Provider Ready/);
  assert.match(
    providerJob,
    /github\.ref == 'refs\/heads\/main' \|\| github\.base_ref == 'main'/,
  );
  assert.match(providerJob, /APP_VARIANT:/);
  assert.match(providerJob, /SUPABASE_PROJECT_REF:/);
  assert.match(providerJob, /iosdoheblabfimkjnvfj/);
  assert.match(providerJob, /xwblovggtvbpiusjfokq/);
  assert.match(
    providerJob,
    /node --test scripts\/check-kakao-provider\.test\.mjs/,
  );
  assert.match(providerJob, /node scripts\/check-kakao-provider\.mjs/);
  assert.doesNotMatch(providerJob, /secrets\.|environment:/);

  for (const gateId of ["preview-release-gate", "promotion-gate"]) {
    const gate = job(gateId);
    assert.equal(declaredNeeds(gate).has("kakao-provider-ready"), true);
    assert.match(gate, /KAKAO_PROVIDER_RESULT/);
    assert.match(gate, /needs\.kakao-provider-ready\.result/);
    assert.match(gate, /Kakao Auth Provider Ready result is/);
    assert.match(gate, /exit 1/);
  }

  const promotionGate = job("promotion-gate");
  assert.match(promotionGate, /!cancelled\(\)/);
  assert.doesNotMatch(promotionGate, /always\(\)/);
});
