# 018 — Teams in setup
Phase: 3 (Game platform)
Depends on: 017
Touches: packages/protocol/src/messages.ts, apps/server/src/room/{roomGame.ts, RoomTable.ts}, apps/server/tests/{roomGame, roomGames}.test.ts, apps/web/src/room/GameScreen.tsx, docs/design/rooms-and-games.md
Spec: docs/design/rooms-and-games.md section 4 (Setup, Teams)

## Rules
- Only for games with `teams`. Joining already puts you on the smaller team (017); a team's order is its rotation order.
- In setup, a player switches team with **Join Team N** under that team: they go to the end of its order. Refused for a full team.
- **Start checks only each team's minimum and maximum.** How even the teams are is the players' call (decided with the owner); the team list shows the sizes. The `maxSizeGap` team rule is gone.
- The host can **Shuffle teams**: everyone dealt into even teams at random (sizes differ by at most 1), from a server-made seed.
- No host "move a player" (decided with the owner): players move themselves.
- Switching and shuffling are setup only. Teams carry over to Play again.
- A game's own setup panel (e.g. Sketch Battle's team look) comes with Sketch Battle, its first user.

## Steps
1. Tests first: switch team (and its order), full team, missing team, not playing, after Start; shuffle balance and same result for the same seed; host only.
2. Protocol: `game.switchTeam {team}`, `game.shuffleTeams`.
3. Server rules in `roomGame.ts`, wired in `RoomTable.ts`.
4. Web: Join Team N buttons in the setup team list, Shuffle teams for the host.

## Done when
- [x] Tests above pass
- [x] Manual (agent, port 5180): 4 test players 2v2, a switch to 1v3, the host shuffles back to 2v2 each time, Start, Play again keeps teams
- [ ] Owner test on 5173 and phone
- [x] pnpm typecheck, lint, test pass
