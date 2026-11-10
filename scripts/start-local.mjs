// `pnpm start`: get a local copy of PlayDen running in one step.
// Every step is safe to repeat and never deletes local data.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const devVars = join(root, "apps/server/.dev.vars");
const webDist = join(root, "apps/web/dist/index.html");

function step(label, command, env = {}) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\n✗ "${label}" failed. Fix the error above and run pnpm start again.`);
    process.exit(result.status ?? 1);
  }
}

step("Installing packages", "pnpm install");

if (!existsSync(devVars)) {
  copyFileSync(join(root, "apps/server/.dev.vars.example"), devVars);
  console.log("\n▸ Created apps/server/.dev.vars from the example.");
}
const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_EMAILS"].filter(
  (name) => !new RegExp(`^${name}=\\S+`, "m").test(readFileSync(devVars, "utf8")),
);
if (missing.length > 0) {
  console.warn(`\n! apps/server/.dev.vars has no value for: ${missing.join(", ")}.`);
  console.warn("  The app starts, but Google sign-in won't work until you fill them in.");
}

// The local Worker serves apps/web/dist, so it has to exist once; Vite serves the live app.
if (!existsSync(webDist)) step("Building the web app once", "pnpm --filter @playden/web build");

step(
  "Applying new database migrations (local only)",
  "pnpm --filter @playden/server db:migrate:local",
  {
    CI: "1",
  },
);

console.log("\n▸ Starting PlayDen at http://localhost:5173 (Ctrl+C to stop)\n");
const dev = spawn("pnpm dev", { cwd: root, shell: true, stdio: "inherit" });
dev.on("exit", (code) => process.exit(code ?? 0));
