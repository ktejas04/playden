# 018 — Teams in setup
Phase: 3 (Game platform)
Depends on: 017
Touches: packages/engine/src/seating.ts, packages/protocol/src/messages.ts, apps/server/src/room/roomGame.ts, apps/server/tests/*, apps/web/src/room/TeamsPanel.tsx (new), apps/web/src/room/SetupScreen.tsx, packages/engine/src/view.ts
Spec: docs/design/rooms-and-games.md section 4 (Setup, Teams)

## Rules
- Only for games with `teams`. Joining already puts you on the smaller team (017); a team's order is its rotation order.
- In setup, a player can switch team, as long as the target team isn't full.
- The host can shuffle teams (seeded, balanced) and move any player to another team.
- Teams carry over to Play again.
- A game can provide its own setup panel through its `/view` entry; Sketch Battle will. Others get the standard team columns.

## Steps
1. Tests first: switch team, full team, shuffle balance with a fixed seed, move by host, refusals for non-hosts.
2. Protocol: `game.switchTeam {team}`, `game.shuffleTeams`, `game.movePlayer {playerId, team}`.
3. Server rules in `roomGame.ts`.
4. Web: `TeamsPanel` with team columns, Join buttons per team, the host's shuffle and per-player move.
5. Optional `SetupPanel` in the game's view entry.

## Done when
- [ ] Tests above pass
- [ ] Manual: 4 test players across two teams, a player switches team, the host shuffles and moves one
- [ ] pnpm typecheck, lint, test pass
