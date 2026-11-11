# 018 — Teams and spectators in the lobby
Phase: 3 (Game platform)
Depends on: 017
Touches: packages/protocol/src/{messages.ts, room.ts, teams.ts (new), index.ts}, packages/protocol/tests/teams.test.ts, apps/server/src/room/{Room.ts, roomGame.ts}, apps/server/tests/room*.test.ts, apps/web/src/screens/Room.tsx, apps/web/src/room/TeamsPanel.tsx (new), docs/PROJECT.md
Spec: docs/PROJECT.md D46; docs/games/sketch-battle.md section 3

## Rules
- Only for games with `teams`. Each team is an ordered list of player ids. Joining a team appends you; that order is the team's rotation.
- A player taps **Join** on a team to move there (leaving any other team). The host can **shuffle** (seeded, balanced sizes) and **move** a player to another team.
- Players not on any team are spectators (D46).
- Start is allowed only when every team has `minSize`–`maxSize` players and sizes differ by at most `maxSizeGap`. Otherwise the reason shows under the Start button.
- A player who leaves the room is removed from their team in the lobby. Mid-game seats are 019.
- Teams are kept for a rematch; "back to lobby" keeps them too, and the host can shuffle again.

## Steps
1. Tests first (`teams.ts`, pure): join, switch, append order, shuffle balance with a fixed seed, the start check and its reasons, leave.
2. Protocol: `lobby.joinTeam`, `lobby.shuffleTeams`, `lobby.movePlayer`; teams in the room snapshot.
3. Server: store teams in room storage. Pass team indexes to `setup`. Spectators get the spectator view.
4. Web: `TeamsPanel` with two columns, Join buttons, a host shuffle and per-player move, spectators listed below, and Start's disabled reason in the bottom bar. Built with shadcn components in PlayDen's style.
5. Tap Race uses teams; check it end to end.

## Done when
- [ ] Tests above pass
- [ ] Manual: 4 test players split into teams, the host shuffles, a fifth player stays a spectator and sees the spectator view
- [ ] pnpm typecheck, lint, test pass
