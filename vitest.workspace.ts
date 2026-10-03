import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core/package.json",
  "packages/api/package.json",
  {
    extends: "packages/web/vite.config.ts",
    test: {
      include: ["packages/web/src/**/*.test.ts"],
      exclude: ["packages/web/e2e/**", "**/node_modules/**"],
      environment: "jsdom",
      name: "@forge/web",
    },
  },
]);
