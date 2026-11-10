# 003 — Web app skeleton
Phase: 2 (Setup)
Depends on: 002
Touches: apps/web/{package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/router.ts, src/index.css, tests/router.test.ts}, vitest.config.ts
Spec: docs/PROJECT.md#mobile-ux-learn-controls-and-learn-mode

## Steps
1. Vite + React + TypeScript + Tailwind v4 (`@tailwindcss/vite`).
2. Tests first: `parseRoute(pathname)` returns `home`, `room { code }` (for `/r/ABCD`, code upper-cased and checked with `roomCodeSchema`), `admin`, or `notFound`.
3. `router.ts`: `parseRoute`, `navigate(path)` via `history.pushState`, and a `useRoute()` hook listening to `popstate` (D24).
4. `App.tsx`: portrait shell (full-height, safe-area padding, bottom action bar slot) with placeholder screens per route.
5. `vite.config.ts`: proxy `/api` and `/auth` to `http://127.0.0.1:8787`, `ws: true` (D27).

## Done when
- [ ] Router tests pass
- [ ] `pnpm --filter web dev` shows the shell at 375 px and desktop widths
- [ ] pnpm typecheck, lint, test pass
