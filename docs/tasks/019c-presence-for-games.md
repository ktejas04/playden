# 019c — Presence for games
Phase: 4 (Sketch Battle), platform part
Depends on: 019
Touches: packages/engine/src/{GameDefinition.ts, testing/*}, apps/server/src/room/{Room.ts, RoomTable.ts, roomGame.ts}, apps/server/tests/*
Spec: docs/PROJECT.md D56; docs/design/rooms-and-games.md section 8 ("Presence")

## Rules
- Games may define `onPresence(state, awayIds, now): Transition`.
- While a game is playing, the room calls it whenever a player's connection drops or comes back (not for Play here, D49, which is never a drop), with the full list of away players.
- `onPlayerLeft` keeps meaning the seat is gone for good (Leave game, ban, removal).
- Games without `onPresence` are unaffected (Tap Race).

## Steps
1. Tests first:
   - a drop mid-game calls `onPresence` with that player away
   - a return calls it with the player no longer away
   - Play here never calls it
   - a game without `onPresence` plays as before
2. Contract and contract kit (the kit calls `onPresence` in its random games when defined).
3. Room wiring.

## Done when
- [ ] Tests above pass
- [ ] pnpm typecheck, lint, test pass
