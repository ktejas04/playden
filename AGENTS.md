# AGENTS.md — rules for any AI agent working on PlayDen

PlayDen is a private, invite-only multiplayer game site for one WhatsApp community.
Everything lives in this folder: code, docs, plans, tasks, local setup.

## Read before doing anything

1. This file.
2. `docs/PROJECT.md`: Decisions log, System architecture, Code practices, Agent playbook.
3. `docs/games/<game-id>.md` if your task touches a game.
4. The task file you were given in `docs/tasks/`.

`docs/PROJECT.md` is the source of truth. If anything disagrees with it, the doc wins.

## Hard rules

- Follow the task file's steps. Touch only the files it lists, unless a small extra file is unavoidable; then say which and why.
- Games never import other games, `apps/server` or `apps/web`. The platform never contains game rules.
- Game engines are pure: no `Date.now()`, `Math.random()`, network or storage. Time and seed come in as arguments.
- Hidden information never leaves the server. Clients get only `view(state, playerId)`.
- Every tunable number lives in the game's `config.ts`.
- The database is defined only in `apps/server/src/db/schema.ts` (Drizzle). Change the schema, then run `pnpm --filter @playden/server db:generate`; never hand-write or edit migrations. Queries and DB types come from the schema, never raw SQL strings.
- UI uses shadcn/ui components from `packages/ui`; don't hand-build widgets or animations.
- Strict TypeScript, no `any`. Validate incoming messages with Zod.
- Comments only where the code cannot explain itself (a formula, a non-obvious rule, a platform workaround).
- Tests first for any rule or formula. Never delete or weaken a test to make it pass.
- No new dependencies, renames or folder restructuring unless the task says so.
- Never commit secrets.
- Changing a decision means updating the Decisions log in `docs/PROJECT.md` in the same change.

## Done means

- `pnpm typecheck && pnpm lint && pnpm test` all pass.
- The task's "Done when" boxes are ticked.
- A 3–5 line summary of what changed.
- Commit when a task, or a meaningful part of a big one, is done and passing: not after every file, not after days of work. Anything the owner can try (a feature, screen or flow) waits until the owner has tested it and confirmed (D28).
- Commit messages are short: `[ADD] room screen`, `[FIX] reconnect loop`, `[UPDATE] setup plan`.
