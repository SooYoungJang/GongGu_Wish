import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_USER_COLUMNS = [
  "push_token",
  "push_provider",
  "push_enabled",
  "deadline_reminders_enabled",
  "new_submissions_enabled",
  "submission_approval_notifications_enabled",
  "marketing_push_enabled",
  "marketing_push_consent_at",
  "marketing_push_consent_version",
  "marketing_push_consent_source",
  "marketing_push_withdrawn_at",
  "notification_reminder_days",
  "followed_influencers",
  "followed_brands",
];

export const REQUIRED_FUNCTIONS = [
  "public.claim_expo_push_token(text,text)",
  "public.set_my_group_buy_reminder_v2(text,text,integer[],integer)",
];

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function listMigrationVersions(root = "supabase/migrations") {
  return readdirSync(root)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
    .sort();
}

export function buildSchemaContractSql({
  migrationVersions = listMigrationVersions(),
  requiredUserColumns = REQUIRED_USER_COLUMNS,
  requiredFunctions = REQUIRED_FUNCTIONS,
} = {}) {
  if (migrationVersions.length === 0) {
    throw new Error("At least one migration version is required");
  }
  const columnValues = requiredUserColumns
    .map((value) => `(${quote(value)})`)
    .join(",\n    ");
  const migrationValues = migrationVersions
    .map((value) => `(${quote(value)})`)
    .join(",\n    ");
  const functionChecks = requiredFunctions
    .map(
      (value) =>
        `  IF to_regprocedure(${quote(value)}) IS NULL THEN\n` +
        `    RAISE EXCEPTION 'schema contract missing function: %', ${quote(value)};\n` +
        "  END IF;",
    )
    .join("\n");

  return `DO $$
DECLARE
  missing_columns text;
  missing_migrations text;
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'schema contract missing supabase_migrations.schema_migrations';
  END IF;

  SELECT string_agg(expected.column_name, ', ' ORDER BY expected.column_name)
    INTO missing_columns
  FROM (VALUES
    ${columnValues}
  ) AS expected(column_name)
  LEFT JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'users'
   AND actual.column_name = expected.column_name
  WHERE actual.column_name IS NULL;

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'schema contract missing users columns: %', missing_columns;
  END IF;

  SELECT string_agg(expected.version, ', ' ORDER BY expected.version)
    INTO missing_migrations
  FROM (VALUES
    ${migrationValues}
  ) AS expected(version)
  LEFT JOIN supabase_migrations.schema_migrations applied
    ON applied.version::text = expected.version
  WHERE applied.version IS NULL;

  IF missing_migrations IS NOT NULL THEN
    RAISE EXCEPTION 'schema contract missing migration versions: %', missing_migrations;
  END IF;

${functionChecks}
  RAISE NOTICE 'Production schema contract passed';
END $$;`;
}

export function buildMigrationHistoryPreflightSql() {
  return `DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'migration history table is missing; reconcile Production before automatic deployment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations) THEN
    RAISE EXCEPTION 'migration history is empty; reconcile Production before automatic deployment';
  END IF;
END $$;`;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function main() {
  const args = process.argv.slice(2);
  const mode = readOption(args, "--mode") ?? "schema";
  const root = readOption(args, "--root") ?? ".";
  const sql =
    mode === "history"
      ? buildMigrationHistoryPreflightSql()
      : buildSchemaContractSql({
          migrationVersions: listMigrationVersions(
            join(root, "supabase/migrations"),
          ),
        });
  process.stdout.write(`${sql}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
