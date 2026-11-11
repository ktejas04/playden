# 016 — Game contract, isolation checks, registry and Tap Race
Phase: 3 (Game platform)
Depends on: 015
Touches: packages/engine/src/{GameDefinition.ts, index.ts, testing/*.ts (new)}, packages/engine/package.json, packages/games/tap-race/** (new), checks/** (new), apps/server/src/games.ts (new), apps/server/package.json, apps/web/src/games.ts (new), apps/web/package.json, scripts/new-game.mjs (new), package.json, vitest.config.ts, eslint.config.js, docs/games/tap-race.md (new), docs/games/README.md, docs/PROJECT.md
Spec: docs/games/tap-race.md; docs/PROJECT.md "Game engine contract", "Code practices and modularity"

## Goal

Adding a game is: run one command, write the rules, and add one line to each registry. Removing a game is: delete its folder and those lines. Machines, not reviewers, keep games isolated and their engines pure, and a shared test kit holds every game to the same contract.

## Design

**One package per game.** `packages/games/<id>` is the workspace package `@playden/game-<id>` with two entry points:
- `@playden/game-<id>`: the engine (definition, types, config). Pure TypeScript, no React. The server imports only this.
- `@playden/game-<id>/view`: the React screens. Only the web app imports this.

**Contract additions to `GameDefinition`** (recorded in the Decisions log):
- `name`, `summary`: for the game picker
- `moveSchema: z.ZodType<Move>`: the room validates moves without knowing the game
- `configSchema: z.ZodType<Config>`: the room validates host settings
- optional `teams: { count, minSize, maxSize, maxSizeGap }`
- optional `devOnly`: hidden unless dev sign-in is on
- `setup` gets seats `{ id, name, team? }`
- `zod` becomes an engine dependency (the only one)

**Contract test kit** (`@playden/engine/testing`). Every game's tests call `describeGameContract(definition, fixture)`. It checks, for any game:
- `setup` is the same for the same seed
- state and every view survive a JSON round trip (rooms store state as JSON)
- `apply`, `onDeadline` and `onPlayerLeft` never change the state they're given (the state is deep-frozen first)
- rejected moves come with a non-empty human-readable reason
- `result` is null at the start
- a seeded random playthrough, driven by moves the fixture suggests and by firing deadlines, never throws and ends within a step limit
- views never contain a hidden-information marker the fixture names (for example the other team's secret)

**Isolation and purity checks** (`checks/architecture.test.ts`, run with `pnpm test`):
- a game never imports another game: no `@playden/game-*` imports, and no relative path leaving its own folder
- a game's engine files never import React, the game's `view/`, or any app
- engine files never use `Date.now`, `Math.random`, `new Date()`, `fetch`, `setTimeout`, `setInterval`, `crypto` or storage
- every folder in `packages/games` is listed in both registries, and every registry entry has a folder
- every game has `config.ts`, `engine.ts`, `types.ts`, `rules.md`, `view/` and `tests/`

**Scaffold:** `pnpm new-game <id> "<Name>"` creates the folder from a template with the standard layout and a passing contract test, adds the two registry lines and the workspace dependencies, and runs install. Removing a game is the reverse, done by hand: delete the folder and the lines (the architecture check then confirms nothing still points at it).

**Registries:** `apps/server/src/games.ts` (id → definition) and `apps/web/src/games.ts` (id → definition + view component), each with `listGames({ includeDevOnly })`.

## Steps
1. Contract additions and the `testing` kit in `packages/engine`, with tests for the kit itself (a deliberately broken toy game must fail each check).
2. `checks/` project with the architecture test; add it to `vitest.config.ts`. Each rule also runs against a small fake repo that breaks it, as permanent tests.
3. Tap Race spec (`docs/games/tap-race.md`):
   - two teams, 1–8 each
   - every tap adds 1 to your team
   - you see your own team's count and the other team's only as "ahead / behind / level"
   - first team to `TARGET_TAPS` (30) wins, or the higher count when the 20 s deadline passes; equal counts are a draw
4. `scripts/new-game.mjs`, then use it to create Tap Race. Write its engine tests first (rules from the spec plus `describeGameContract`), then the engine and a simple view (one big tap button, the two scores).
5. Registries on server and web. Update PROJECT.md: the repo layout (`checks/`, scaffold), "Adding a game" (the command), and the Decisions log.

## Done when
- [x] Contract kit tests pass, and each check fails on its broken toy game (11 broken variants)
- [x] Architecture checks pass, and each rule fails on a fake repo that breaks it (kept as permanent tests)
- [x] `pnpm new-game` creates a game that passes all checks with no edits
- [x] Tap Race passes its rule tests and the contract kit
- [x] Both registries list Tap Race only when dev-only games are allowed
- [x] pnpm typecheck, lint, test pass
