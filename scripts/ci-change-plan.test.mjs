import assert from "node:assert/strict";
import test from "node:test";

import { classifyChangedFiles } from "./ci-change-plan.mjs";

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
