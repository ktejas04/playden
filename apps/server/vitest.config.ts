import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          // Dev-only games (Tap Race) must be pickable in tests, with or without a local .dev.vars.
          DEV_LOGIN: "true",
          // Socket tests play at once; the countdown itself is tested in roomGame.test.ts.
          START_COUNTDOWN_MS: "0",
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
});
