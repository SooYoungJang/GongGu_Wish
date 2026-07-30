export const DEPLOYED_ENVIRONMENT_CONTRACT = {
  preview: {
    projectRef: "xwblovggtvbpiusjfokq",
    supabaseUrl: "https://xwblovggtvbpiusjfokq.supabase.co",
  },
  production: {
    projectRef: "iosdoheblabfimkjnvfj",
    supabaseUrl: "https://iosdoheblabfimkjnvfj.supabase.co",
  },
} as const;

export type AdminAppEnvironment =
  | keyof typeof DEPLOYED_ENVIRONMENT_CONTRACT
  | "development";

export type SupabaseEnv = {
  VITE_APP_ENV?: string;
  VITE_COMMIT_SHA?: string;
  VITE_GIT_REF?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function getSupabaseConfig(env: SupabaseEnv) {
  const appEnvironment = env.VITE_APP_ENV?.trim() as
    | AdminAppEnvironment
    | undefined;
  const commitSha = env.VITE_COMMIT_SHA?.trim();
  const gitRef = env.VITE_GIT_REF?.trim();
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env",
    );
  }

  if (
    !appEnvironment ||
    !["development", "preview", "production"].includes(appEnvironment)
  ) {
    throw new Error("VITE_APP_ENV must be development, preview, or production");
  }

  let projectRef = "local";
  try {
    const parsed = new URL(supabaseUrl);
    const match = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);
    projectRef = match?.[1] ?? "local";
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid URL");
  }

  if (appEnvironment !== "development") {
    const expected = DEPLOYED_ENVIRONMENT_CONTRACT[appEnvironment];
    const label = appEnvironment === "preview" ? "Preview" : "Production";
    if (supabaseUrl !== expected.supabaseUrl) {
      throw new Error(
        `${label} Admin must use ${expected.supabaseUrl} as its Supabase origin`,
      );
    }
    if (!commitSha || !/^[0-9a-f]{40}$/.test(commitSha)) {
      throw new Error(
        `${label} Admin requires an exact 40-character commit SHA`,
      );
    }
    if (!gitRef) {
      throw new Error(`${label} Admin requires an exact Git ref`);
    }
    if (appEnvironment === "production" && gitRef !== "main") {
      throw new Error("Production Admin must be built from the main branch");
    }
    if (appEnvironment === "preview" && gitRef === "main") {
      throw new Error("Preview Admin must not be built from the main branch");
    }
    projectRef = expected.projectRef;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    appEnvironment,
    commitSha: commitSha || "local",
    gitRef: gitRef || "local",
    projectRef,
    adminApiOrigin: `${supabaseUrl}/functions/v1/admin-api`,
  };
}
