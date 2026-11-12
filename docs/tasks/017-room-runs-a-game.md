# 017 — Game sessions in a room
Phase: 3 (Game platform)
Depends on: 016
Touches: packages/engine/src/{GameDefinition.ts, seating.ts (new), index.ts}, packages/engine/tests/*, packages/protocol/src/messages.ts, packages/protocol/tests/*, apps/server/src/room/{Room.ts, RoomTable.ts, roomGame.ts, tableSync.ts, host.ts (new)}, apps/server/tests/{roomGame, roomGames, room, host}.test.ts, apps/web/src/room/*, apps/web/src/screens/Room.tsx, apps/web/tests/*, docs/PROJECT.md
Spec: docs/design/rooms-and-games.md (D51), sections 3–7

## Rules
The design doc is the spec. This task covers:

- **Room states:** Idle → Setup → Playing → Results, with one game session at a time.
- **Game participants:** players join in order, spectators, and banned members. Members with no role are just in the room.
- **Setup:**
  - Picking a game joins the host.
  - Everyone else gets the setup popup (Join game / Spectate, ✕ to close).
  - Switching is free until Start. The host can't spectate.
  - "Game is full" when the game has no seats left.
  - Changing the game keeps the joined players; overflow moves to spectating.
  - Cancel goes back to Idle.
- **Teams, minimal:**
  - Joining puts you on the smaller team, the first team on a tie.
  - Start checks the team rules and shows the reason when they aren't met.
  - Switching teams, shuffle and move come in 018.
- **Start:** seats the joined players in join order.
- **Playing:**
  - Arrivals are in the room and get a Spectate-only popup.
  - Leave game frees the seat and runs `onPlayerLeft`.
  - Ban from game (host): the player is out and can't join this session again.
  - End game (host) finishes Ended early: standings from the game's optional `standings(state)`, no winner.
  - The session ends on its own when no players are left.
  - Removal from the room (D42) counts as Leave game.
- **Results:**
  - Shown automatically to players and spectators.
  - Play again: players and spectators carry over in their roles, and people just in the room get the popup.
  - Return to room goes back to Idle.
- **Host:**
  - One host.
  - In Setup and Playing the next host is a connected player, by room seniority.
  - In Setup with no player left, any member becomes host and is joined.
  - While Playing with no connected player, host stays put.
  - Handover still happens at once on a drop. The 60 s grace is 019.
- **Badges:** Playing and Spectating on the room screen's member list.

## Steps
1. Tests first:
   - pure session rules in `roomGame.ts`
   - host choice in `host.ts`
   - seat checks in the engine
   - protocol schemas
2. Engine:
   - `seatProblem(game, seats)` for counts and team rules
   - `joinTeam` (the smaller team)
   - optional `standings(state)`
3. Protocol:
   - client messages `game.pick`, `game.setConfig`, `game.join`, `game.spectate`, `game.leave`, `game.start`, `game.ban`, `game.end`, `game.playAgain`, `game.returnToRoom`, `move`
   - `game.status` carries the session, or null when Idle
4. Server:
   - session rules in `roomGame.ts`
   - host choice in `host.ts`
   - `Room.ts` and `RoomTable.ts` wired together, so a change to the session can move the host and vice versa
5. Web:
   - the setup popup and the "Setting up" or "Game in progress" card on the room screen
   - the setup screen (players, settings, Join game / Spectate, Start)
   - the game screen with a menu (Leave game, End game, Ban)
   - results with Play again / Return to room
   - badges on the room screen
6. Tests 1–5, 7, 8, 10–14 and 16–18 from the design doc's test list, as socket tests with Tap Race.

## Done when
- [ ] Tests above pass
- [ ] Manual with test players on PC and phone: every flow in the design doc's section 4
- [ ] pnpm typecheck, lint, test pass
