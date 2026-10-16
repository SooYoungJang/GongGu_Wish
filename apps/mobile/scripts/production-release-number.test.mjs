import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

function commitFiles(repo, files) {
  for (const [path, content] of Object.entries(files)) {
    const target = join(repo.cwd, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    repo.git("add", "--", path);
  }
  repo.git("commit", "-m", "update release inputs");
}

test("keeps release 17 at the baseline and ignores empty Production commits", (t) => {
  const repo = repository(t);
  assert.equal(resolveProductionReleaseNumber(repo), "17");
  repo.git("commit", "--allow-empty", "-m", "no app change");
  assert.equal(resolveProductionReleaseNumber(repo), "17");
});

test("increments for RN OTA and native changes and keeps retries stable", (t) => {
  const repo = repository(t);
  commitFiles(repo, { "apps/mobile/src/App.tsx": "OTA change" });
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  commitFiles(repo, { "apps/mobile/app.json": "{}" });
  assert.equal(resolveProductionReleaseNumber(repo), "19");
});

test("counts a promotion with several develop commits as one release", (t) => {
  const repo = repository(t);
  repo.git("switch", "-c", "develop");
  commitFiles(repo, { "apps/mobile/src/App.tsx": "feature one" });
  commitFiles(repo, { "apps/mobile/src/App.tsx": "feature two" });
  repo.git("switch", "main");
  repo.git("merge", "--no-ff", "develop", "-m", "promote develop");
  assert.equal(resolveProductionReleaseNumber(repo), "18");
});

test("excludes admin, backend and documentation releases without gaps in RN numbering", (t) => {
  const repo = repository(t);
  commitFiles(repo, {
    "apps/admin/src/관리자.ts": "admin change",
    "apps/api/src/app.service.ts": "API change",
    "workers/api-proxy/src/index.ts": "Worker change",
    "supabase/functions/example/index.ts": "Edge Function change",
    "packages/ui-web/src/Button.tsx": "Web-only UI change",
    "apps/mobile/README.md": "mobile documentation change",
  });
  assert.equal(resolveProductionReleaseNumber(repo), "17");
  commitFiles(repo, { "apps/mobile/src/App.tsx": "RN release one" });
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  commitFiles(repo, { "apps/admin/src/관리자.ts": "another admin change" });
  assert.equal(resolveProductionReleaseNumber(repo), "18");
  commitFiles(repo, { "apps/mobile/src/App.tsx": "RN release two" });
  assert.equal(resolveProductionReleaseNumber(repo), "19");
});

test("includes shared dependency changes that affect the RN app", (t) => {
  const repo = repository(t);
  commitFiles(repo, { "packages/shared/src/types.ts": "RN dependency change" });
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
