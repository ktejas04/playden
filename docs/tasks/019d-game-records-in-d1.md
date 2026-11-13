# 019d — Game records in D1
Phase: 4 (Sketch Battle), platform part (every game benefits)
Depends on: 017, 019
Touches: packages/protocol/src/{room.ts, session.ts}, packages/protocol/tests/*, apps/web/src/screens/Room.tsx, apps/server/src/db/{schema.ts, gameRecords.ts}, apps/server/migrations/*, apps/server/src/room/{Room.ts, RoomTable.ts, roomGame.ts, gameRecords.ts, RecordWriter.ts}, apps/server/tests/{gameRecords.test.ts, roomRecords.test.ts}, packages/engine/src/{GameDefinition.ts, testing/contract.ts}, packages/games/tap-race/{engine.ts, tests/*}
Spec: docs/PROJECT.md D58, D59; docs/design/rooms-and-games.md section 2

## Rules
- Tables `rooms`, `games`, `game_participants` as in D58, and `room_members` as in D59, defined in `schema.ts`, migration generated with `db:generate`. No `CHECK` constraints (D37).
- `games.status` is the game's lifecycle (setup, playing, finished, ended_early). `games.is_active` marks the room's current game; a unique index allows at most one active game per room.
- When the room writes:
  - room created: insert `rooms` (the room keeps the record id in `info`)
  - a new game session, or the host switching game in setup: the old row goes inactive, a new row is inserted (status setup, active, created_by and host_id both the host)
  - host passes on while the room has a game: that game's host_id is updated (created_by never changes)
  - Start: status playing, started_at, config; insert participants (players and spectators)
  - the game ends: status finished or ended_early, ended_at, winning_team, summary; participants updated with scores, left_early and leave_reason: left (Leave game or left the room), banned (from the game), removed (from the room) (spectators who joined mid-game are added). Nothing is written during setup
  - Play again, Return to room, or the session closing for lack of players: the row goes inactive
  - room closes: a game still playing is ended as ended_early, the active row goes inactive, `rooms.closed_at` is set
- Games may define `recordSummary(state)`: small, plain JSON kept in `games.summary`. Tap Race keeps its team counts and target.
- `room_members`, one row per visit: a new row on arrival (reconnecting within the grace is the same visit; coming back after leaving opens a new visit and the old one keeps its reason), closed on a final departure: left, removed, timed_out (away past the grace without a game seat); room_closed for anyone still listed when the room closes.
- Ban and Remove (D59): removing a player seated in a running game is refused ("They're playing. Ban them from the game first"), so `game_participants.leave_reason` is only left or banned. Only the host can remove; admins are regular people in rooms unless host.
- Writes go through one queue per room, in order, never awaited by game play. Each is retried twice before it's logged and dropped. Rooms created before this change (no record id) write nothing.

## Steps
1. Tests first:
   - pure: a new session opens a record; switching game in setup replaces it; Start, the end and an early end produce the right updates; Play again and Return to room deactivate; the winning team comes from the winners; ordinary moves produce nothing
   - with a real room and D1: creating a room inserts it; when host passes on, host_id follows and created_by stays; set up, start and finish a Tap Race game and the rows match (status, is_active, scores, participants, summary); Play again leaves exactly one active game; the room closing sets closed_at and deactivates its game
   - members: an arrival opens a visit; a drop and reconnect is the same visit; leave, removal and a grace timeout record their reasons; coming back opens a new visit and earlier ones keep theirs; at most one open visit; the room closing closes out everyone still there
   - removal: refused for a seated player mid-game, allowed after a ban and for spectators; only the host can remove; the host can remove an admin
   - the contract kit checks that a game's record summary is plain JSON
2. Schema and migration; `db/gameRecords.ts` (one function per write).
3. `room/gameRecords.ts` (pure: which writes a table change needs), `room/RecordWriter.ts` (the queue), wiring in `Room.ts` and `RoomTable.ts`.
4. `recordSummary` in the contract and in Tap Race.

## Done when
- [x] Tests above pass
- [x] Manual: play a Tap Race game locally, then check the rows with `wrangler d1 execute` (commands in the summary)
- [x] pnpm typecheck, lint, test pass
