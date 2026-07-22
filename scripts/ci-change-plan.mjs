import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const WORKSPACES = [
  "@gonggu/admin",
  "@gonggu/api",
  "@gonggu/mobile",
  "@gonggu/shared",
  "@gonggu/ui-web",
  "@gonggu/web",
];

function createPlan() {
  return {
    docsOnly: false,
    ci: false,
    quality: false,
    build: false,
    test: false,
    api: false,
    edgeTests: false,
    localSupabase: false,
    workerTests: false,
    dependencyReview: false,
    supabase: false,
    database: false,
    functions: false,
    worker: false,
    admin: false,
    mobile: false,
    workspaceFilters: "",
    workspaceTestFilters: "",
  };
}

function isDocumentation(path) {
  return (
    path.endsWith(".md") ||
    path.startsWith("docs/") ||
    path.startsWith(".github/ISSUE_TEMPLATE/") ||
    path === "LICENSE" ||
    path === "LICENSE.txt"
  );
}

function isDependencyFile(path) {
  return (
    /(^|\/)package(-lock)?\.json$/.test(path) ||
    /(^|\/)(deno\.lock|requirements[^/]*\.txt|pyproject\.toml|uv\.lock)$/.test(
      path,
    )
  );
}

export function classifyChangedFiles(inputFiles) {
  const files = inputFiles
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
  const plan = createPlan();
  const workspaces = new Set();

  const addWorkspace = (...names) => {
    plan.quality = true;
    for (const name of names) workspaces.add(name);
  };

  const selectEveryComponent = () => {
    addWorkspace(...WORKSPACES);
    plan.api = true;
    plan.edgeTests = true;
    plan.localSupabase = true;
    plan.workerTests = true;
    plan.dependencyReview = true;
    plan.supabase = true;
    plan.database = true;
    plan.functions = true;
    plan.worker = true;
    plan.admin = true;
    plan.mobile = true;
  };

  if (files.length === 0) {
    selectEveryComponent();
  } else {
    plan.docsOnly = files.every(isDocumentation);

    for (const path of files) {
      if (isDocumentation(path)) continue;
      if (isDependencyFile(path)) plan.dependencyReview = true;

      if (
        path.startsWith(".github/") ||
        path.startsWith("scripts/") ||
        path.startsWith(".husky/") ||
        path.startsWith(".maestro/") ||
        path.startsWith("e2e-dashboard/")
      ) {
        plan.ci = true;
        continue;
      }

      if (
        ["package.json", "package-lock.json", "turbo.json"].includes(path) ||
        /^(tsconfig|eslint|prettier|vitest|jest)[^/]*\./.test(path)
      ) {
        addWorkspace(...WORKSPACES);
        plan.api = true;
        plan.admin = true;
        plan.mobile = true;
        continue;
      }

      if (path.startsWith("apps/admin/")) {
        addWorkspace("@gonggu/admin");
        plan.admin = true;
        continue;
      }
      if (path.startsWith("apps/mobile/")) {
        addWorkspace("@gonggu/mobile");
        plan.mobile = true;
        continue;
      }
      if (path.startsWith("apps/api/")) {
        addWorkspace("@gonggu/api");
        plan.api = true;
        continue;
      }
      if (path.startsWith("apps/web/")) {
        addWorkspace("@gonggu/web");
        continue;
      }
      if (path.startsWith("packages/shared/")) {
        addWorkspace(...WORKSPACES);
        plan.api = true;
        plan.admin = true;
        plan.mobile = true;
        continue;
      }
      if (path.startsWith("packages/ui-web/")) {
        addWorkspace("@gonggu/ui-web", "@gonggu/web");
        continue;
      }

      if (
        path.startsWith("supabase/migrations/") ||
        path === "supabase/seed.sql"
      ) {
        plan.localSupabase = true;
        plan.supabase = true;
        plan.database = true;
        continue;
      }
      if (path.startsWith("supabase/functions/")) {
        plan.edgeTests = true;
        plan.localSupabase = true;
        plan.supabase = true;
        plan.functions = true;
        continue;
      }
      if (path === "supabase/config.toml") {
        plan.edgeTests = true;
        plan.localSupabase = true;
        plan.supabase = true;
        plan.database = true;
        plan.functions = true;
        continue;
      }
      if (path.startsWith("supabase/")) {
        plan.localSupabase = true;
        continue;
      }

      if (path.startsWith("workers/api-proxy/")) {
        plan.workerTests = true;
        plan.worker = true;
        continue;
      }

      selectEveryComponent();
    }
  }

  const selectedWorkspaces = WORKSPACES.filter((name) => workspaces.has(name));
  plan.build = plan.quality;
  plan.workspaceTestFilters = selectedWorkspaces
    .filter((name) => name !== "@gonggu/api")
    .map((name) => `--filter=${name}`)
    .join(" ");
  plan.test = plan.workspaceTestFilters.length > 0;
  plan.workspaceFilters = selectedWorkspaces
    .map((name) => `--filter=${name}`)
    .join(" ");

  return plan;
}

function toOutputs(plan) {
  return {
    docs_only: plan.docsOnly,
    ci: plan.ci,
    quality: plan.quality,
    build: plan.build,
    test: plan.test,
    api: plan.api,
    edge_tests: plan.edgeTests,
    local_supabase: plan.localSupabase,
    worker_tests: plan.workerTests,
    dependency_review: plan.dependencyReview,
    supabase: plan.supabase,
    database: plan.database,
    functions: plan.functions,
    worker: plan.worker,
    admin: plan.admin,
    mobile: plan.mobile,
    workspace_filters: plan.workspaceFilters,
    workspace_test_filters: plan.workspaceTestFilters,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const filesIndex = args.indexOf("--files");
  const outputIndex = args.indexOf("--github-output");
  const exitIndex = args.indexOf("--exit-for");
  if (filesIndex === -1 || !args[filesIndex + 1]) {
    throw new Error(
      "Usage: node scripts/ci-change-plan.mjs --files <path> [--github-output <path>]",
    );
  }

  const files = readFileSync(args[filesIndex + 1], "utf8").split(/\r?\n/);
  const plan = classifyChangedFiles(files);
  const outputs = toOutputs(plan);

  if (outputIndex !== -1 && args[outputIndex + 1]) {
    const lines = Object.entries(outputs).map(
      ([key, value]) => `${key}=${value}`,
    );
    appendFileSync(args[outputIndex + 1], `${lines.join("\n")}\n`);
  }

  process.stdout.write(
    `${JSON.stringify({ files: files.filter(Boolean), ...outputs }, null, 2)}\n`,
  );

  if (exitIndex !== -1 && args[exitIndex + 1]) {
    const component = args[exitIndex + 1];
    if (!(component in plan)) {
      throw new Error(`Unknown component for --exit-for: ${component}`);
    }
    process.exitCode = plan[component] ? 1 : 0;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli();
}
