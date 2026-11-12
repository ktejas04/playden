# Phase 3 — Game platform

## Goal

A room can run any game that implements `GameDefinition`: the host picks a game, players form teams, the host starts, moves flow through the engine, each player sees only their own view, timers fire on their own, and the game ends back in the lobby. It's proven end to end with a tiny dev-only test game before Sketch Battle starts. Local testing works on phones and with several players on one PC.

## In scope

- Dev test-player sign-in for local testing (014). It's independent of everything else and goes first.
- Seeded randomness and helpers in `packages/engine` (015).
- Game contract additions, the game registry, and the dev-only test game **Tap Race** (016).
- The room runs a game: pick, start, moves, per-player views, deadlines, results, Play again (017).
- Teams in the lobby for team games, with spectators as everyone not on a team (018).
- One device per player in a room, with "Play here" to move the seat like Meet's "Switch here" (014b, built early).
- Away players keep their seat for 60 s, then the game hears they left; mid-game joiners spectate (019).

## Out of scope (later)

- Lobby object, caps, kill switch, live room list.
- General chat (Sketch Battle's feed is its guesses).
- A ban ending a live room seat.
- PWA install and Wake Lock.

These come before the first full community release, as "Platform extras".

## Tasks

| # | Title | Depends on |
| --- | --- | --- |
| 014 | Dev test-player sign-in | — |
| 014b | One device per player ("Play here") | 013 |
| 015 | Seeded randomness | — |
| 016 | Game contract, registry and Tap Race | 015 |
| 017 | Game sessions in a room (docs/design/rooms-and-games.md) | 016 |
| 018 | Teams in setup | 017 |
| 019 | Away players and host grace | 017, 014b |

014 and 015 don't touch the same files, so they can run in parallel.

## Done when

- [ ] Tap Race plays end to end on two phones and a PC over the local network with test players: pick, teams, start, play, results, Play again.
- [ ] Dropping a phone's connection mid-game and coming back within 60 s keeps the player's seat.
- [ ] Opening the room as the same player on a second device moves the seat there; "Play here" moves it back.
- [ ] pnpm typecheck, lint, test pass.
