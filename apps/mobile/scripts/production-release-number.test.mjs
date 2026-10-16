import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveProductionReleaseNumber } from "./production-release-number.mjs";

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "gonggu-release-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Release Test",
        "-c",
        "user.email=release@example.test",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  git("init", "-b", "main");
  git("commit", "--allow-empty", "-m", "existing release 17");
  return { cwd, git, baselineCommit: git("rev-parse", "HEAD") };
}

test("keeps release 17 at the existing Production baseline", (t) => {
  const repo = repository(t);
  assert.equal(resolveProductionReleaseNumber(repo), "17");
});

test("increments for new Production commits and keeps retries stable", (t) => {
  const repo = repository(t);
  repo.git("commit", "--allow-empty", "-m", "OTA release");
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  repo.git("commit", "--allow-empty", "-m", "native release");
  assert.equal(resolveProductionReleaseNumber(repo), "19");
});

test("counts a promotion with several develop commits as one release", (t) => {
  const repo = repository(t);
  repo.git("switch", "-c", "develop");
  repo.git("commit", "--allow-empty", "-m", "feature one");
  repo.git("commit", "--allow-empty", "-m", "feature two");
  repo.git("switch", "main");
  repo.git("merge", "--no-ff", "develop", "-m", "promote develop");
  assert.equal(resolveProductionReleaseNumber(repo), "18");
});

test("rejects incomplete or unrelated history instead of resetting the counter", (t) => {
  const repo = repository(t);
  assert.throws(
    () =>
      resolveProductionReleaseNumber({
        cwd: repo.cwd,
        baselineCommit: "0".repeat(40),
      }),
    /Production release baseline.*full main history/,
  );
});
