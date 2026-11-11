# 016 — Game contract, registry and Tap Race
Phase: 3 (Game platform)
Depends on: 015
Touches: packages/engine/src/{GameDefinition.ts, index.ts}, packages/games/tap-race/** (new), apps/server/src/games.ts (new), apps/web/src/games.ts (new), pnpm-workspace.yaml, eslint.config.js, docs/games/tap-race.md (new), docs/games/README.md, docs/PROJECT.md
Spec: docs/games/tap-race.md

## Why

The room needs a real game to run before Sketch Battle exists. Tap Race is tiny, has a deadline, a hidden-information rule and teams, so it exercises every part of the contract. It's dev-only and never shown in production.

## Steps
1. Contract additions to `GameDefinition` (record in the Decisions log):
   - `name: string` and `summary: string` for the game picker
   - `moveSchema: z.ZodType<Move>`, so the room can validate moves without knowing the game
   - `configSchema: z.ZodType<Config>`, so the room can validate host settings
   - optional `teams?: { count: number; minSize: number; maxSize: number; maxSizeGap: number }`
   - optional `devOnly?: boolean`
   - `setup` receives each player's team index when the game has teams
   - `zod` becomes a dependency of `packages/engine`
2. Write `docs/games/tap-race.md` (short):
   - two teams, 1–8 each
   - every tap adds 1 to your team
   - you see your own team's count and the other team's only as "ahead / behind"
   - first team to `TARGET_TAPS` (30) wins, or the higher count when the 20 s deadline passes
3. Tests first in `packages/games/tap-race/tests`, one per rule in the spec (setup, tap counting, the view hides the exact opponent count, the deadline ends the game, result).
4. Build `packages/games/tap-race` with the standard layout (`config.ts`, `types.ts`, `engine.ts`, `view/`, `rules.md`, `tests/`). The view is one big tap button and the two scores.
5. Registries: `apps/server/src/games.ts` (id → definition) and `apps/web/src/games.ts` (id → definition + view component). A `listGames({ includeDevOnly })` helper.
6. Lint boundaries: add `packages/games/*` to the module-boundary rules (games import only engine, protocol and ui; never each other or apps).

## Done when
- [ ] Tap Race engine tests pass
- [ ] Both registries list Tap Race only when dev-only games are allowed
- [ ] Lint fails if a game imports another game or an app (checked once by hand, then reverted)
- [ ] pnpm typecheck, lint, test pass
