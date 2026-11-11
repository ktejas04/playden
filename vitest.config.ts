import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/engine", "packages/protocol", "apps/web", "apps/server"],
    passWithNoTests: true,
  },
});
