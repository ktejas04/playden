# 002 — Shared packages: engine, protocol, ui
Phase: 2 (Setup)
Depends on: 001
Touches: packages/engine/*, packages/protocol/*, packages/ui/*, eslint.config.js, vitest.config.ts
Spec: docs/PROJECT.md#game-engine-contract, #rooms-lobby-and-realtime-protocol, #code-practices-and-modularity

## Steps
1. `packages/engine` (`@playden/engine`): `GameDefinition` and its helper types (`Player`, `GameEvent`, `GameResult`, `Ok`) exactly as in PROJECT.md. Types only for now.
2. `packages/protocol` (`@playden/protocol`), adds `zod`:
   - `ROOM_CODE_ALPHABET` (A–Z without I, L, O), `roomCodeSchema` (4 letters from it).
   - `RoomPlayer` `{ id, name, connected }`.
   - Client messages: `ping { t }`.
   - Server messages: `snapshot { room: { code, players } }`, `pong { t, serverTime }`, `error { reason }`.
   - `parseClientMessage(raw: string)` returns the message or an error reason.
3. Tests first in `packages/protocol/tests/messages.test.ts`: valid messages pass; unknown type, bad code, extra-long strings and non-JSON fail.
4. `packages/ui` (`@playden/ui`): empty `src/index.ts` plus package files, so the layout exists.
5. Module-boundary lint rules from the PROJECT.md table via `no-restricted-imports`, one block per package folder.

## Done when
- [x] Protocol tests pass
- [x] Importing `apps/*` from a package fails lint (checked by hand once)
- [x] pnpm typecheck, lint, test pass

## Notes
- `validate` returns `{ ok: true } | { ok: false; reason }` (a discriminant makes callers simpler); the PROJECT.md snippet was updated to match.
