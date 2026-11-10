import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/protocol", "apps/web"],
    passWithNoTests: true,
  },
});
