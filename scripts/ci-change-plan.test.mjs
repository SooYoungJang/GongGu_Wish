import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyChangedFiles,
  shouldBuildVercelProject,
} from "./ci-change-plan.mjs";

const changePlanCli = fileURLToPath(
  new URL("./ci-change-plan.mjs", import.meta.url),
);

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function expectOnly(plan, enabled) {
  const deploymentKeys = [
    "supabase",
    "database",
    "functions",
    "worker",
    "admin",
    "mobile",
  ];
  for (const key of deploymentKeys) {
    assert.equal(plan[key], enabled.includes(key), `${key} classification`);
  }
}

test("Markdown-only changes skip every build and deployment", () => {
  const plan = classifyChangedFiles(["AGENTS.md", "docs/branch-strategy.md"]);

  assert.equal(plan.docsOnly, true);
  assert.equal(plan.quality, false);
  assert.equal(plan.build, false);
  assert.equal(plan.test, false);
  assert.equal(plan.edgeTests, false);
  assert.equal(plan.localSupabase, false);
  assert.equal(plan.workerTests, false);
  assert.equal(plan.dependencyReview, false);
  assert.equal(plan.workspaceFilters, "");
  expectOnly(plan, []);
});

test("Admin changes run only affected workspace checks and Vercel", () => {
  const plan = classifyChangedFiles(["apps/admin/src/App.tsx"]);

  assert.equal(plan.docsOnly, false);
  assert.equal(plan.quality, true);
  assert.equal(plan.build, true);
  assert.equal(plan.test, true);
  assert.match(plan.workspaceFilters, /--filter=@gonggu\/admin/);
  expectOnly(plan, ["admin"]);
});

test("API-only changes reserve PostgreSQL for the API test job", () => {
  const plan = classifyChangedFiles(["apps/api/src/app.service.ts"]);

  assert.equal(plan.api, true);
  assert.equal(plan.quality, true);
  assert.equal(plan.test, false);
  assert.equal(plan.workspaceFilters, "--filter=@gonggu/api");
  expectOnly(plan, []);
});

test("Mobile changes run only affected workspace checks and mobile deployment", () => {
  const plan = classifyChangedFiles(["apps/mobile/src/screens/HomeScreen.tsx"]);

  assert.equal(plan.quality, true);
  assert.match(plan.workspaceFilters, /--filter=@gonggu\/mobile/);
  expectOnly(plan, ["mobile"]);
});

test("Mobile E2E impact includes every journey dependency", () => {
  for (const file of [
    ".github/workflows/mobile-ios-e2e.yml",
    ".maestro/gon-263-critical-journeys.yaml",
    ".maestro/gon-264-android-accessibility.yaml",
    ".maestro/gon-229-notification-preferences.yaml",
    "apps/mobile/src/App.tsx",
    "packages/shared/src/index.ts",
    "supabase/migrations/20260722000001_example.sql",
    "scripts/run-gon263-android-e2e.sh",
    "scripts/gon229-notification-contract.test.mjs",
    "package-lock.json",
  ]) {
    assert.equal(
      classifyChangedFiles([file]).mobileE2e,
      true,
      `${file} must run Mobile E2E`,
    );
  }

  for (const file of [
    ".github/workflows/ci.yml",
    "apps/web/src/app/page.tsx",
    "docs/branch-strategy.md",
  ]) {
    assert.equal(
      classifyChangedFiles([file]).mobileE2e,
      false,
      `${file} must not run Mobile E2E`,
    );
  }
});

test("Database migrations run Supabase contracts without rebuilding apps", () => {
  const plan = classifyChangedFiles([
    "supabase/migrations/20260722000001_example.sql",
  ]);

  assert.equal(plan.quality, false);
  assert.equal(plan.localSupabase, true);
  assert.equal(plan.edgeTests, false);
  expectOnly(plan, ["supabase", "database"]);
});

test("Edge Function changes run Deno and local Supabase checks", () => {
  const plan = classifyChangedFiles([
    "supabase/functions/hiker-lookup/index.ts",
  ]);

  assert.equal(plan.quality, false);
  assert.equal(plan.edgeTests, true);
  assert.equal(plan.localSupabase, true);
  expectOnly(plan, ["supabase", "functions"]);
});

test("Worker changes run only Worker checks and deployment", () => {
  const plan = classifyChangedFiles(["workers/api-proxy/src/index.js"]);

  assert.equal(plan.quality, false);
  assert.equal(plan.workerTests, true);
  expectOnly(plan, ["worker"]);
});

test("Shared package changes include every dependent workspace and app", () => {
  const plan = classifyChangedFiles(["packages/shared/src/index.ts"]);

  assert.equal(plan.quality, true);
  for (const workspace of [
    "admin",
    "api",
    "mobile",
    "web",
    "shared",
    "ui-web",
  ]) {
    assert.match(plan.workspaceFilters, new RegExp(`@gonggu/${workspace}`));
  }
  expectOnly(plan, ["admin", "mobile"]);
});

test("Root dependency changes conservatively validate every workspace", () => {
  const plan = classifyChangedFiles(["package-lock.json"]);

  assert.equal(plan.dependencyReview, true);
  assert.equal(plan.api, true);
  assert.equal(plan.quality, true);
  expectOnly(plan, ["admin", "mobile"]);
});

test("Workflow-only changes run policy checks without dependency review", () => {
  const plan = classifyChangedFiles([".github/workflows/ci.yml"]);

  assert.equal(plan.ci, true);
  assert.equal(plan.dependencyReview, false);
  assert.equal(plan.quality, false);
  assert.equal(plan.test, false);
  expectOnly(plan, []);
});

test("Vercel Web builds only when its workspace is affected", () => {
  assert.equal(
    shouldBuildVercelProject(
      classifyChangedFiles([".github/workflows/ci.yml"]),
      "web",
    ),
    false,
  );

  for (const file of [
    "apps/web/app/page.tsx",
    "packages/ui-web/src/index.ts",
    "packages/shared/src/index.ts",
    "package-lock.json",
  ]) {
    assert.equal(
      shouldBuildVercelProject(classifyChangedFiles([file]), "web"),
      true,
      `${file} must build the Vercel Web project`,
    );
  }
});

test("explicit Production recovery conservatively revalidates every component", () => {
  const plan = classifyChangedFiles([".github/workflows/ci.yml"], {
    productionRecovery: true,
  });

  assert.equal(plan.quality, true);
  assert.equal(plan.edgeTests, true);
  assert.equal(plan.localSupabase, true);
  assert.equal(plan.workerTests, true);
  expectOnly(plan, [
    "supabase",
    "database",
    "functions",
    "worker",
    "admin",
    "mobile",
  ]);
});

test("Unknown paths fail safe by selecting every component", () => {
  const plan = classifyChangedFiles(["new-runtime/entrypoint.ts"]);

  assert.equal(plan.quality, true);
  assert.equal(plan.edgeTests, true);
  assert.equal(plan.localSupabase, true);
  assert.equal(plan.workerTests, true);
  expectOnly(plan, [
    "supabase",
    "database",
    "functions",
    "worker",
    "admin",
    "mobile",
  ]);
});

test("An empty push fails safe by selecting every component", () => {
  const plan = classifyChangedFiles([]);

  assert.equal(plan.docsOnly, false);
  assert.equal(plan.quality, true);
  expectOnly(plan, [
    "supabase",
    "database",
    "functions",
    "worker",
    "admin",
    "mobile",
  ]);
});

test("tree-identical merge commits force exact-SHA Vercel builds", () => {
  const repository = mkdtempSync(join(tmpdir(), "gonggu-ci-plan-"));

  try {
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.email", "ci@example.test");
    git(repository, "config", "user.name", "CI Test");
    git(repository, "config", "commit.gpgsign", "false");

    writeFileSync(join(repository, "README.md"), "baseline\n");
    git(repository, "add", "README.md");
    git(repository, "commit", "-m", "baseline");
    const previousSha = git(repository, "rev-parse", "HEAD");

    mkdirSync(join(repository, "scripts"));
    writeFileSync(join(repository, "scripts", "ci-policy.mjs"), "export {};\n");
    git(repository, "add", "scripts/ci-policy.mjs");
    git(repository, "commit", "-m", "ci-only change");
    const nonMergeSha = git(repository, "rev-parse", "HEAD");

    git(repository, "checkout", "-b", "metadata-merge");
    git(repository, "commit", "--allow-empty", "-m", "metadata only");
    git(repository, "checkout", "main");
    git(repository, "merge", "--no-ff", "metadata-merge", "-m", "merge metadata");
    const mergeSha = git(repository, "rev-parse", "HEAD");

    git(repository, "checkout", "-b", "changed-merge");
    writeFileSync(
      join(repository, "scripts", "merge-policy.mjs"),
      "export {};\n",
    );
    git(repository, "add", "scripts/merge-policy.mjs");
    git(repository, "commit", "-m", "merge-only CI change");
    git(repository, "checkout", "main");
    git(repository, "merge", "--no-ff", "changed-merge", "-m", "merge CI change");
    const changedMergeSha = git(repository, "rev-parse", "HEAD");

    for (const projectFlag of ["--vercel-admin", "--vercel-web"]) {
      const normal = spawnSync(process.execPath, [changePlanCli, projectFlag], {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: nonMergeSha,
        },
      });
      assert.equal(normal.status, 0, `${projectFlag} should skip a CI-only commit`);

      const merge = spawnSync(process.execPath, [changePlanCli, projectFlag], {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: mergeSha,
        },
      });
      if (projectFlag === "--vercel-admin") {
        assert.equal(
          merge.status,
          1,
          "Admin must build a tree-identical merge commit",
        );
        assert.match(merge.stdout, /tree-identical merge/i);
      } else {
        assert.equal(
          merge.status,
          0,
          "Web keeps using its changed-file classification",
        );
      }
    }

    const changedMerge = spawnSync(
      process.execPath,
      [changePlanCli, "--vercel-admin"],
      {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: changedMergeSha,
        },
      },
    );
    assert.equal(
      changedMerge.status,
      0,
      "a tree-changing CI-only merge keeps using changed-file classification",
    );

    const ordinaryEmptyDiff = spawnSync(
      process.execPath,
      [changePlanCli, "--vercel-admin"],
      {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: nonMergeSha,
          VERCEL_GIT_COMMIT_SHA: nonMergeSha,
        },
      },
    );
    assert.equal(
      ordinaryEmptyDiff.status,
      1,
      "an ordinary empty diff still builds fail-safe",
    );

    const malformedSha = spawnSync(
      process.execPath,
      [changePlanCli, "--vercel-admin"],
      {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: "not-a-commit-sha",
        },
      },
    );
    assert.equal(malformedSha.status, 1, "malformed SHAs must build fail-safe");

    const missingObject = spawnSync(
      process.execPath,
      [changePlanCli, "--vercel-admin"],
      {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: "f".repeat(40),
        },
      },
    );
    assert.equal(
      missingObject.status,
      1,
      "missing exact-SHA Git objects must build fail-safe",
    );
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test("Windows policy workarounds remain actionable for future agents", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const gitNetwork = readFileSync(
    new URL("./git-network.ps1", import.meta.url),
    "utf8",
  );

  assert.match(agents, /scripts\/git-network\.ps1 fetch develop/);
  assert.match(agents, /scripts\/git-network\.ps1 push codex\/<task-name>/);
  assert.match(agents, /Rollup.*GitHub Actions.*Linux CI/s);
  assert.match(gitNetwork, /isomorphic-git@\$isomorphicGitVersion/);
  assert.match(gitNetwork, /\["auth", "token"\]/);
  assert.match(gitNetwork, /--ignore-scripts/);
});

test("Preview Green accepts only Vercel bot statuses for the Admin Preview", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(workflow, /--arg owner "\$GITHUB_REPOSITORY_OWNER"/);
  assert.match(workflow, /\.creator\.login == "vercel\[bot\]"/);
  assert.match(workflow, /\.environment == "Preview – gong-gu-wish-admin"/);
  assert.match(
    workflow,
    /test\("\^https:\/\/gong-gu-wish-admin-\[a-z0-9-\]\+-jsy10835\\\\\.vercel\\\\\.app\/\?\$"\)/,
  );
});
