# Phase 4 — Sketch Battle

## Goal

Sketch Battle playable by our community, built in five game phases (D43) that each end in something people can play and give feedback on. Rules: `docs/games/sketch-battle.md`.

## Before it starts

Phase 3 (Game platform) is done: rooms run games, teams and spectators exist, and away seats work.

## In scope

Everything in the spec. Each game phase's task files are written when that phase starts, so they can use what the previous phase taught us. Only 4.1's files exist now.

## Out of scope

- Learn-controls tour (v2)
- Hindi or Hinglish word packs (D45)
- Custom word packs
- Undo on the canvas

## Tasks

**4.1 Core round:** two teams play rounds end to end.

| # | Title | Depends on |
| --- | --- | --- |
| 020 | Screen mockups: lobby, choose, drawer, guesser, round result | — |
| 021 | Engine: round flow, guessing and scoring | 015–018 |
| 022 | Starter English word list | — |
| 023 | Drawing canvas and stroke batching | 017 |
| 024 | Block preview of the other team | 021, 023 |
| 025 | Round screens wired to the room | 020, 021, 023, 024 |

**4.2 Full match:** a 15-round match plays like the original.

| # | Title |
| --- | --- |
| 026 | Engine: winner-stays rotation, streaks, head starts |
| 027 | Head start stage and matchup badges |
| 028 | Round summary, replays and ready-up |
| 029 | Disconnect rules and the spectator view |

**4.3 Showdown:** the complete game.

| # | Title |
| --- | --- |
| 030 | Engine: showdown |
| 031 | Showdown screens |
| 032 | Results, highlights and rematch |

**4.4 Settings and words:** the host can tune games.

| # | Title |
| --- | --- |
| 033 | Host settings |
| 034 | Full English word list (~500) and the word-length toggle |

**4.5 Polish:** feels finished.

| # | Title |
| --- | --- |
| 035 | Our animations: drawer handoff, showdown card, correct-guess pulse |
| 036 | Sounds and mute |
| 037 | Home game card and PC layout tuning |

## Done when (whole phase)

- [ ] A full game (15 rounds and the showdown) plays with 4–8 people on phones and PCs
- [ ] Every edge case in the spec has its named test
- [ ] pnpm typecheck, lint, test pass
