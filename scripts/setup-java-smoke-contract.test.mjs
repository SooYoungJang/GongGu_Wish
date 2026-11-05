import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { classifyChangedFiles } from "./ci-change-plan.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workflowPath = ".github/workflows/setup-java-smoke.yml";
const workflow = read(workflowPath);
const expectedSha = "b843ebf9b913146b38da2eaa7aeddf76074ae1ad";

test("Java smoke handles only relevant develop pull request events", () => {
  const eventSection = workflow.split("\non:\n")[1]?.split("\n# Public")[0];
  assert.equal(
    eventSection?.trim(),
    `pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened]
    paths:
      - ".github/workflows/ci.yml"
      - ".github/workflows/mobile-ios-e2e.yml"
      - ".github/workflows/setup-java-smoke.yml"
      - "scripts/setup-java-smoke-contract.test.mjs"`,
  );
  assert.doesNotMatch(workflow, /pull_request_target|workflow_dispatch|schedule:/);
});

test("Java smoke uses two free standard runners with bounded execution", () => {
  assert.match(workflow, /runner: \[ubuntu-latest, macos-15\]/);
  assert.equal((workflow.match(/^    runs-on:/gm) || []).length, 1);
  assert.match(workflow, /runs-on: \$\{\{ matrix\.runner \}\}/);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /group: setup-java-smoke-\$\{\{ github\.event\.pull_request\.number \}\}/);
});

test("Java smoke has no repository permissions, secrets, deployment or storage steps", () => {
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.equal((workflow.match(/^\s*permissions:/gm) || []).length, 1);
  assert.doesNotMatch(workflow, /\bsecrets\.|^\s*environment:|^\s*env:/m);
  assert.doesNotMatch(workflow, /continue-on-error:|uses:.*(?:checkout|upload-artifact|cache@)/);
  assert.match(workflow, /cache-jdk: false/);
  assert.match(workflow, /token: ""/);
  const actions = [...workflow.matchAll(/^\s*uses: (\S+)/gm)].map((match) => match[1]);
  assert.deepEqual(actions, [`actions/setup-java@${expectedSha}`]);
});

test("All five existing Java callers and the smoke use the same pinned action", () => {
  let callers = 0;
  for (const path of [".github/workflows/ci.yml", ".github/workflows/mobile-ios-e2e.yml"]) {
    const content = read(path);
    const matches = [...content.matchAll(/uses: actions\/setup-java@([a-f0-9]{40})[^\n]*\n\s*with:\n\s*distribution: "?temurin"?\n\s*java-version: "17"/g)];
    callers += matches.length;
    for (const match of matches) assert.equal(match[1], expectedSha, path);
  }
  assert.equal(callers, 5);
  assert.match(workflow, /distribution: temurin\n\s*java-version: "17"/);
});

test("The compiler/runtime probe checks version, vendor and JAVA_HOME without external commands", () => {
  const run = workflow.split("        run: |\n")[1];
  assert.ok(run);
  const script = run.replace(/^ {10}/gm, "");
  assert.equal(spawnSync("bash", ["-n"], { input: script }).status, 0);
  assert.match(script, /javac --release 17/);
  assert.ok(script.includes('test "$(command -v javac)" -ef "$JAVA_HOME/bin/javac"'));
  assert.ok(script.includes("'javac 17'|'javac 17.'*) ;;"));
  assert.ok(script.includes('echo "Unexpected compiler: $javac_version" >&2; exit 1'));
  assert.match(script, /java -cp "\$workdir" SetupJavaSmoke/);
  assert.match(script, /java\.specification\.version/);
  assert.match(script, /Eclipse Adoptium/);
  assert.match(script, /java\.home/);
  assert.doesNotMatch(script, /\b(?:curl|wget|npm|gradle|eas|gh|sudo)\b/);
});

test("Java workflow-only changes select CI policies without application deployments", () => {
  const plan = classifyChangedFiles([
    ".github/workflows/ci.yml",
    ".github/workflows/mobile-ios-e2e.yml",
    workflowPath,
    "scripts/setup-java-smoke-contract.test.mjs",
  ]);
  assert.equal(plan.ci, true);
  for (const key of ["quality", "build", "test", "supabase", "database", "functions", "worker", "admin", "mobile"]) {
    assert.equal(plan[key], false, key);
  }
  assert.match(read(".github/workflows/ci.yml"), /scripts\/setup-java-smoke-contract\.test\.mjs/);
});
