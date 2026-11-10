# 004 — Server Worker skeleton
Phase: 2 (Setup)
Depends on: 003
Touches: apps/server/{package.json, tsconfig.json, wrangler.toml, vitest.config.ts, src/index.ts, src/env.ts, src/http.ts, tests/health.test.ts}, apps/server/.dev.vars.example, package.json, vitest.config.ts, README.md
Spec: docs/PROJECT.md#system-architecture, #deployment-and-environments

## Steps
1. Add `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers` (version matched to Vitest) to `apps/server`.
2. `wrangler.toml`: name `playden`, assets from `../web/dist` with SPA fallback, worker runs first for `/api/*` and `/auth/*`, D1 binding `DB` (placeholder id until task 011).
3. Tests first: `GET /api/health` returns `{ ok: true }`; an unknown `/api/...` path returns 404 JSON.
4. `src/index.ts`: plain fetch handler routing by method + path; `src/http.ts`: `json()` and `errorJson()` helpers.
5. Root `pnpm dev` runs web and server together (`pnpm -r --parallel dev`); root `pnpm build` builds web.
6. `.dev.vars.example` with empty `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`.
7. README "Running locally": install, copy `.dev.vars.example`, `pnpm dev`, open `http://localhost:5173`.

## Done when
- [x] Health tests pass in the Workers test pool
- [x] `pnpm dev`: `http://localhost:5173/api/health` answers through the proxy
- [x] pnpm typecheck, lint, test pass

## Notes
- Test pool is `@cloudflare/vitest-plugin` (vitest-pool-workers was renamed); env types come from `wrangler types --include-runtime=false` into `worker-configuration.d.ts`, runtime types from `@cloudflare/workers-types`.
- Extra file: `.claude/launch.json` so the agent's browser pane can start `pnpm dev`.
- The Worker needs `apps/web/dist` to exist; build the web app once before `pnpm dev` or tests.
