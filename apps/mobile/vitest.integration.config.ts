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
    hookTimeout: 120_000,
    include: ["src/integration/**/*.integration.test.ts"],
    testTimeout: 120_000,
  },
});
