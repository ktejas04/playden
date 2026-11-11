# 017 — Room runs a game
Phase: 3 (Game platform)
Depends on: 016
Touches: packages/protocol/src/{messages.ts, room.ts, index.ts}, packages/protocol/tests/*, apps/server/src/room/{Room.ts, roomGame.ts (new), gameStore.ts (new)}, apps/server/tests/room*.test.ts, apps/web/src/room/useRoomSocket.ts, apps/web/src/screens/Room.tsx, apps/web/src/room/GameHost.tsx (new), apps/web/tests/*, docs/PROJECT.md
Spec: docs/PROJECT.md "Rooms, lobby and realtime protocol"

## Rules
- Room phases: `lobby` → `playing` → `results` → back to `lobby`.
- Lobby: the host picks a game and sets its settings. Only games allowed here appear (dev-only games only when `DEV_LOGIN` is on).
- Start (host only): the room checks player counts, creates the seed, and calls `setup`.
- Every `move` is parsed with the game's `moveSchema`, then `validate`, then `apply` with server time as `now`. A rejection goes back only to the sender as `error` with the game's reason.
- After every change, each player gets their own `view(state, playerId)`; spectators get `view(state, "spectator")`. Full views are fine for now; send one only to players whose view changed.
- `events` from `apply` and `onDeadline` go to everyone.
- After every change, the room sets its alarm to `nextDeadline(state)`. The alarm calls `onDeadline`. The existing empty-room close alarm must keep working alongside it.
- When `result(state)` is not null, the room moves to `results` and shows the scores. The host can **rematch** (same game, settings and teams) or go **back to lobby**.
- Game state lives in Durable Object storage, so a room survives eviction and hibernation mid-game.
- Room logic that doesn't need the Durable Object (applying a move, computing who gets which view) lives in `roomGame.ts` as plain functions, so it's testable without sockets.

## Steps
1. Tests first:
   - protocol schemas for `lobby.pickGame`, `lobby.settings`, `game.start`, `move`, `game.view`, `game.events`, `game.ended`, `game.rematch`, `game.toLobby`
   - `roomGame.ts`: start checks, move routing, rejections reach only the sender, views per player, deadline handling, the results transition
   - Room tests with Tap Race: start, taps, deadline end, rematch, state survives a reload of the object
2. Protocol messages and types.
3. Server: `roomGame.ts`, `gameStore.ts` (load and save state), and wiring them into `Room.ts`.
4. Web:
   - `GameHost.tsx` renders the current game's view component with its view and a `sendMove` function.
   - The lobby gets a game picker and settings for the host. Others see what's picked.
   - A results screen with Rematch / Back to lobby for the host.
5. Decisions log in PROJECT.md: room phases, full per-player views for now, rejections only to the sender.

## Done when
- [ ] Tests above pass
- [ ] Manual with test players: pick Tap Race, start, tap from two browsers, the game ends on target or deadline, rematch works
- [ ] pnpm typecheck, lint, test pass
