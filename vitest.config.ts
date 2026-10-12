import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/web/**/*.{test,spec}.{ts,tsx}",
      "packages/shared/**/*.{test,spec}.{ts,tsx}",
      "eslint-rules/**/*.{test,spec}.ts",
    ],
  },
  resolve: {
    alias: {
      "@postific/shared": path.resolve(__dirname, "packages/shared/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
});
