import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = "supabase/migrations";
const migrationSql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(path.join(migrationsDir, name), "utf8"))
  .join("\n");
const pendingReadsMigration = readFileSync(
  path.join(
    migrationsDir,
    "20261004000001_restrict_pending_manual_discovery_reads.sql",
  ),
  "utf8",
);

test("manual-discovery visibility updates existing policies without dropping them", () => {
  for (const policy of ["group_buys_public_read", "raw_posts_public_read"]) {
    assert.match(
      pendingReadsMigration,
      new RegExp(`ALTER POLICY\\s+"${policy}"[\\s\\S]*?TO anon, authenticated[\\s\\S]*?USING`, "i"),
    );
  }
  assert.doesNotMatch(pendingReadsMigration, /DROP POLICY/i);
});

function latestPolicy(name) {
  const starts = [...migrationSql.matchAll(new RegExp(`(?:CREATE|ALTER) POLICY\\s+"${name}"`, "gi"))];
  assert.ok(starts.length > 0, `missing ${name} policy`);
  const start = starts.at(-1).index;
  const end = migrationSql.indexOf(";", start);
  return migrationSql.slice(start, end + 1);
}

for (const [table, policy] of [
  ["group_buys", "group_buys_public_read"],
  ["raw_posts", "raw_posts_public_read"],
]) {
  test(`${table} public RLS allowlists approved manual discoveries`, () => {
    const statement = latestPolicy(policy);

    assert.doesNotMatch(statement, /USING\s*\(\s*true\s*\)/i);
    const normalized = statement.toLowerCase().replaceAll(/\s+/g, " ");
    assert.ok(normalized.includes("to anon, authenticated"));
    if (table === "group_buys") {
      assert.ok(normalized.includes("source_type is distinct from 'manual_discovery'"));
      assert.ok(normalized.includes("collection_review_status = 'approved'"));
      assert.ok(normalized.includes("status in ('approved', 'expired')"));
    } else {
      assert.ok(
        normalized.includes(
          "private.is_manual_discovery_raw_post_public( raw_posts.id, raw_posts.collection_source::text )",
        ),
      );
    }
    assert.match(statement, new RegExp(`ON\\s+public\\.${table}`, "i"));
  });
}

test("raw-post visibility helper is private to PostgREST and bypasses group-buy RLS safely", () => {
  const helperStart = migrationSql.lastIndexOf(
    "CREATE OR REPLACE FUNCTION private.is_manual_discovery_raw_post_public",
  );
  assert.ok(helperStart >= 0, "missing security-definer raw-post visibility helper");
  const helperEnd = migrationSql.indexOf("$$;", helperStart);
  assert.ok(helperEnd > helperStart, "visibility helper body is incomplete");
  const helper = migrationSql.slice(helperStart, helperEnd + 3);

  assert.match(helper, /SECURITY DEFINER/i);
  assert.match(helper, /SET search_path = public, pg_temp/i);
  assert.match(helper, /NOT EXISTS/i);
  assert.match(helper, /source_type = 'MANUAL_DISCOVERY'/i);
  assert.match(helper, /collection_review_status = 'APPROVED'/i);
  assert.match(helper, /status IN \('APPROVED', 'EXPIRED'\)/i);
  assert.match(
    migrationSql,
    /REVOKE ALL ON FUNCTION private\.is_manual_discovery_raw_post_public\(\s*text,\s*text\s*\) FROM PUBLIC/i,
  );
  assert.match(
    migrationSql,
    /GRANT EXECUTE ON FUNCTION private\.is_manual_discovery_raw_post_public\(\s*text,\s*text\s*\)\s*TO anon, authenticated/i,
  );
  const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
  assert.match(supabaseConfig, /schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(supabaseConfig, /schemas = .*private/);
});

test("manual discoveries cannot enter approved-only definer ranking in an inconsistent state", () => {
  const constraintStart = migrationSql.lastIndexOf(
    'ADD CONSTRAINT "group_buys_manual_discovery_review_state_check"',
  );
  assert.ok(constraintStart >= 0, "missing manual review state constraint");
  const constraintEnd = migrationSql.indexOf(";", constraintStart);
  const constraint = migrationSql.slice(constraintStart, constraintEnd + 1);

  assert.match(constraint, /source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'/i);
  assert.match(constraint, /collection_review_status IS NOT NULL/i);
  assert.match(constraint, /collection_review_status = 'PENDING'[\s\S]*status = 'REVIEW_REQUIRED'/i);
  assert.match(constraint, /collection_review_status = 'APPROVED'[\s\S]*status IN \('APPROVED', 'EXPIRED'\)/i);
  assert.match(constraint, /collection_review_status = 'REJECTED'[\s\S]*status = 'REJECTED'/i);
});

test("manual-discovery RLS leaves admin policy access unchanged", () => {
  assert.match(migrationSql, /CREATE POLICY\s+"group_buys_admin_all"[\s\S]*?USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
  assert.match(migrationSql, /CREATE POLICY\s+"raw_posts_admin_all"[\s\S]*?USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
});

const groupBuysController = readFileSync(
  "apps/api/src/group-buys/group-buys.controller.ts",
  "utf8",
);
const searchController = readFileSync(
  "apps/api/src/search/search.controller.ts",
  "utf8",
);
const rawPostsController = readFileSync(
  "apps/api/src/raw-posts/raw-posts.controller.ts",
  "utf8",
);

test("public Nest routes use visibility-filtered service methods", () => {
  assert.ok(groupBuysController.includes("groupBuysService.listPublic(query)"));
  assert.ok(groupBuysController.includes("groupBuysService.getPublic(id)"));
  assert.ok(searchController.includes("groupBuysService.listPublic(query)"));
  assert.ok(rawPostsController.includes("rawPostsService.listPublic(query)"));
});

const adminController = readFileSync(
  "apps/api/src/admin/admin.controller.ts",
  "utf8",
);

test("Nest admin read paths require an explicit admin-role guard", () => {
  assert.ok(adminController.includes("@UseGuards(JwtAuthGuard, AdminRoleGuard)"));
});

test("manual source markers cannot drift between raw posts and group buys", () => {
  assert.match(
    migrationSql,
    /CREATE TRIGGER group_buys_manual_discovery_source_alignment[\s\S]*?BEFORE INSERT OR UPDATE OF raw_post_id, source_type ON public\.group_buys[\s\S]*?EXECUTE FUNCTION private\.enforce_manual_discovery_group_buy_source_alignment\(\)/i,
  );
  assert.match(
    migrationSql,
    /CREATE TRIGGER raw_posts_manual_discovery_source_alignment[\s\S]*?BEFORE UPDATE OF collection_source ON public\.raw_posts[\s\S]*?EXECUTE FUNCTION private\.enforce_manual_discovery_raw_post_source_alignment\(\)/i,
  );
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION private\.enforce_manual_discovery_group_buy_source_alignment[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/i,
  );
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION private\.enforce_manual_discovery_raw_post_source_alignment[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/i,
  );
});

const groupBuysService = readFileSync(
  "apps/api/src/group-buys/group-buys.service.ts",
  "utf8",
);
const rawPostsService = readFileSync(
  "apps/api/src/raw-posts/raw-posts.service.ts",
  "utf8",
);

test("public Nest filters require matching source markers and approved review state", () => {
  assert.match(groupBuysService, /RawPostCollectionSource\.MANUAL_DISCOVERY/);
  assert.match(groupBuysService, /sourceType: "MANUAL_DISCOVERY"/);
  assert.match(groupBuysService, /collectionReviewStatus: CollectionReviewStatus\.APPROVED/);
  assert.match(groupBuysService, /GroupBuyStatus\.APPROVED, GroupBuyStatus\.EXPIRED/);
  assert.match(rawPostsService, /RawPostCollectionSource\.MANUAL_DISCOVERY/);
  assert.match(rawPostsService, /collectionReviewStatus: CollectionReviewStatus\.APPROVED/);
  assert.match(rawPostsService, /sourceType: "MANUAL_DISCOVERY"/);
});

const popularFunctionStart = migrationSql.lastIndexOf(
  "CREATE OR REPLACE FUNCTION public.get_popular_group_buys(",
);
assert.ok(popularFunctionStart >= 0, "missing public popularity RPC");
const popularFunctionEnd = migrationSql.indexOf("$$;", popularFunctionStart);
const popularFunction = migrationSql.slice(popularFunctionStart, popularFunctionEnd + 3);

test("public popularity definer RPC excludes unreviewed manual group buys", () => {
  assert.match(popularFunction, /SECURITY DEFINER/i);
  assert.match(popularFunction, /SET search_path = public, pg_temp/i);
  assert.match(popularFunction, /JOIN public\.group_buys AS group_buy/i);
  assert.match(popularFunction, /group_buy\.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'/i);
  assert.match(popularFunction, /group_buy\.collection_review_status = 'APPROVED'/i);
  assert.match(popularFunction, /group_buy\.status IN \('APPROVED', 'EXPIRED'\)/i);
  assert.match(
    migrationSql,
    /GRANT EXECUTE ON FUNCTION public\.get_popular_group_buys\(int, int\)[\s\S]*?TO anon, authenticated/i,
  );
});
