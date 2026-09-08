import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gonggu/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  test: {
    environment: "node",
    // Suites share one database. Fixture cleanup must not alter another suite's
    // ranking snapshot while it walks the same catalog through cursor pages.
    fileParallelism: false,
    hookTimeout: 120_000,
    include: ["src/integration/**/*.integration.test.ts"],
    setupFiles: ["src/integration/requireLocalSupabase.ts"],
    testTimeout: 120_000,
  },
});
