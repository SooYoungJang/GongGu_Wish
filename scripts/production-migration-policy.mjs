import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DESTRUCTIVE_PATTERNS = [
  {
    code: "DROP",
    pattern:
      /\bDROP\s+(?:TABLE|COLUMN|SCHEMA|INDEX|FUNCTION|TYPE|POLICY|VIEW|SEQUENCE)\b/i,
  },
  { code: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
  { code: "DELETE", pattern: /\bDELETE\s+FROM\b/i },
  {
    code: "ALTER_TYPE",
    pattern: /\bALTER\s+TABLE\b[\s\S]*?\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i,
  },
];

const ALLOWED_RUNTIME_DELETE =
  /(^|\n)[ \t]*--[ \t]*production-migration-policy:[ \t]*allow-runtime-delete[ \t]*\r?\n[ \t]*DELETE[ \t]+FROM\b[^\r\n;]*\bWHERE\b[^\r\n;]*;/gi;
const DOLLAR_QUOTE = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g;

function isRuntimeSqlBlock(source, offset) {
  let openQuote = null;
  for (const match of source.slice(0, offset).matchAll(DOLLAR_QUOTE)) {
    if (openQuote === null) {
      openQuote = { delimiter: match[0], offset: match.index };
    } else if (match[0] === openQuote.delimiter) {
      openQuote = null;
    }
  }
  if (openQuote === null) return false;

  const header = source.slice(Math.max(0, openQuote.offset - 4000), openQuote.offset);
  return (
    /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b[\s\S]*\bAS\s*$/i.test(header) ||
    /\bSELECT\s+cron\.schedule\s*\([^;]*,\s*$/i.test(header)
  );
}

function stripAllowedRuntimeDeletes(source) {
  return source.replace(
    ALLOWED_RUNTIME_DELETE,
    (match, lineStart, offset) =>
      isRuntimeSqlBlock(source, offset + lineStart.length) ? lineStart : match,
  );
}

export function findDestructiveMigrations(
  files,
  { readFile = (path) => readFileSync(path, "utf8") } = {},
) {
  const findings = [];
  for (const file of files) {
    const source = stripAllowedRuntimeDeletes(readFile(file));
    for (const { code, pattern } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(source)) {
        findings.push({ file, code });
      }
    }
  }
  return findings;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function main() {
  const args = process.argv.slice(2);
  const filesPath = readOption(args, "--files");
  const allowDestructive = args.includes("--allow-destructive");
  if (!filesPath) throw new Error("--files is required");

  const files = readFileSync(filesPath, "utf8")
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const findings = findDestructiveMigrations(files);
  if (findings.length === 0) {
    process.stdout.write("Production migration policy passed.\n");
    return;
  }

  if (!allowDestructive) {
    for (const finding of findings) {
      process.stderr.write(
        `Destructive migration requires explicit approval: ${finding.file} (${finding.code})\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Explicit destructive migration approval supplied for ${findings.length} finding(s).\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
