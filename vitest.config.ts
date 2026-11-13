import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "checks",
      "packages/engine",
      "packages/games/*",
      "packages/protocol",
      "packages/ui",
      "apps/web",
      "apps/server",
    ],
    passWithNoTests: true,
  },
});
