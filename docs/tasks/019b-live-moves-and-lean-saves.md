# 019b — Live moves and lean saves
Phase: 4 (Sketch Battle), platform part
Depends on: 017, 019
Touches: packages/engine/src/{GameDefinition.ts, testing/*}, packages/protocol/src/messages.ts, apps/server/src/room/{Room.ts, RoomTable.ts, tableSync.ts, roomGame.ts, rateLimit.ts}, apps/server/src/config.ts, apps/server/tests/*, apps/web/src/room/{useRoomSocket.ts, gameState.ts}, packages/games/tap-race/* (only if it adopts live taps), docs/PROJECT.md
Spec: docs/PROJECT.md D55, "Fast moves", "Hosting, free-tier budget and costs"

## Why
Today every move reads the stored table, saves it whole (1 row written) and re-books the alarm (1 more row), then sends every viewer their full view. Fast games would use up the 100,000 rows-a-day free allowance in about 2 room-hours.

## Rules
- The room keeps the table in memory once loaded, and reloads it from storage only when it wakes up.
- `Transition` gains `live?: true`. A live transition updates memory and is not saved. Any other change saves the table once (which carries unsaved live changes).
- While live changes are unsaved, a `setTimeout` keeps the room awake; after `LIVE_MAX_UNSAVED_MS` (60 s) with no save, the room saves. No alarm is used for this.
- Games may define `delta(before, after, viewer)`. If they do, the room sends `game.delta` `{ seq, delta }` after every change and `game.view` only on join, reconnect and `game.resync`. Without it, behaviour is as today (full views).
- `seq` counts per session in memory. After the room reloads from storage it starts a new epoch, so phones resync. A phone that sees a gap sends `game.resync`.
- The alarm is booked only when the earliest wake-up time differs from the booked one (`getAlarm()`).
- A game may set `moveLimit: { perSecond, burst }`; the room uses it per connection instead of `MOVE_LIMIT` (D54).
- Contract kit: a live transition never changes `nextDeadline`.

## Steps
1. Tests first:
   - a live move is not saved, and the next normal move saves both
   - a room that reloads from storage has every normal change and drops only unsaved live ones
   - the alarm isn't re-booked when the deadline is unchanged, and is when it changes
   - a game with `delta` gets deltas; join and resync get the full view
   - a sequence gap leads to a resync
   - a game's own move limit replaces the default
   - the contract kit fails a toy game whose live move changes the deadline
2. Engine contract and contract kit; protocol messages (`game.delta`, `game.resync`).
3. Room: in-memory table, save rules, keep-awake timer, alarm check, per-game move limit.
4. Web: apply deltas in the game state; resync on a gap; show own guesses faded until confirmed (helper only; games use it).
5. Update PROJECT.md if anything differs from D55.

## Done when
- [ ] Tests above pass
- [ ] Manual: Tap Race still plays end to end on two phones; a reload mid-game comes back to the same state
- [ ] pnpm typecheck, lint, test pass
