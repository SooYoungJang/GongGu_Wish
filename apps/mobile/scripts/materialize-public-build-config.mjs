import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL("../src/lib/public-build-config.ts", import.meta.url),
);

export function renderPublicBuildConfig({
  apiProxyUrl,
  supabaseAnonKey,
  supabaseUrl,
}) {
  const values = {
    apiProxyUrl: apiProxyUrl?.trim(),
    supabaseAnonKey: supabaseAnonKey?.trim(),
    supabaseUrl: supabaseUrl?.trim(),
  };

  if (Object.values(values).some((value) => !value)) {
    throw new Error("The public build configuration is incomplete.");
  }

  return [
    "// Generated from the validated EAS environment for this deployment.",
    "// The deployment script restores the environment-backed template on exit.",
    `export const publicBuildConfig = Object.freeze(${JSON.stringify(values, null, 2)});`,
    "",
  ].join("\n");
}

async function main() {
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT_PATH;
  const source = renderPublicBuildConfig({
    apiProxyUrl: process.env.EXPO_PUBLIC_API_PROXY_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  });

  await writeFile(outputPath, source, { encoding: "utf8", mode: 0o600 });
  console.log("Validated public build configuration materialized.");
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    const message =
      error instanceof Error
        ? error.message
        : "Public build configuration materialization failed.";
    console.error(`::error::${message}`);
    process.exitCode = 1;
  });
}
