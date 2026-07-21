import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { getSupabaseConfig } from "./src/supabase/env";

function releaseIdentityPlugin(identity: Record<string, string>): Plugin {
  return {
    name: "admin-release-identity",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "release-identity.json",
        source: `${JSON.stringify(identity, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const isVercel = env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
  const appEnvironment = isVercel
    ? env.VERCEL_ENV
    : env.VITE_APP_ENV || "development";
  const commitSha = isVercel
    ? env.VERCEL_GIT_COMMIT_SHA
    : env.VITE_COMMIT_SHA || env.GITHUB_SHA || "local";
  const gitRef = isVercel
    ? env.VERCEL_GIT_COMMIT_REF
    : env.VITE_GIT_REF || env.GITHUB_REF_NAME || "local";
  const runtimeConfig = getSupabaseConfig({
    VITE_APP_ENV: appEnvironment,
    VITE_COMMIT_SHA: commitSha,
    VITE_GIT_REF: gitRef,
    VITE_SUPABASE_URL:
      env.VITE_SUPABASE_URL ||
      (isVercel ? undefined : "http://127.0.0.1:54321"),
    VITE_SUPABASE_ANON_KEY:
      env.VITE_SUPABASE_ANON_KEY || (isVercel ? undefined : "build-anon-key"),
  });

  return {
    define: {
      "import.meta.env.VITE_APP_ENV": JSON.stringify(
        runtimeConfig.appEnvironment,
      ),
      "import.meta.env.VITE_COMMIT_SHA": JSON.stringify(
        runtimeConfig.commitSha,
      ),
      "import.meta.env.VITE_GIT_REF": JSON.stringify(runtimeConfig.gitRef),
    },
    plugins: [
      react(),
      releaseIdentityPlugin({
        environment: runtimeConfig.appEnvironment,
        commitSha: runtimeConfig.commitSha,
        gitRef: runtimeConfig.gitRef,
        supabaseProjectRef: runtimeConfig.projectRef,
        supabaseOrigin: runtimeConfig.supabaseUrl,
        adminApiOrigin: runtimeConfig.adminApiOrigin,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@gonggu/shared": path.resolve(__dirname, "../../packages/shared/src"),
      },
    },
    server: {
      port: 5174,
    },
  };
});
