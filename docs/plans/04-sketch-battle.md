# Phase 4 — Sketch Battle

## Goal

Sketch Battle playable by our community, built in five game phases (D43) that each end in something people can play and give feedback on. Rules: `docs/games/sketch-battle.md`; its section 23 is the step-by-step checklist.

## Before it starts

Phase 3 (Game platform) is done: rooms run games, teams and spectators exist, and away seats work. Platform tasks come first: fast-moving games need 019b and 019c (D55, D56), and 019d keeps a record of every room and game (D58).

## In scope

Everything in the spec. Each game phase's task files are written when that phase starts, so they can use what the previous phase taught us. Files exist for 019b, 019c, 019d and 020–025.

## Out of scope

- Learn-controls tour (v2)
- Word packs, player-written words, Hindi or Hinglish words (D45)
- Streamer mode
- Undo on the canvas

## Tasks

**Platform first**

| # | Title | Depends on |
| --- | --- | --- |
| 019b | Live moves and lean saves | 017, 019 |
| 019c | Presence for games | 019 |
| 019d | Game records in D1 (every game) | 017, 019 |

**4.1 Core round:** two teams play rounds end to end.

| # | Title | Depends on |
| --- | --- | --- |
| 020 | Screen mockups and the feel | — |
| 021 | Engine: round flow, guessing and scoring | 019b, 019c |
| 022 | Word list (~2,500, our own) | — |
| 023 | Drawing canvas and stroke sending | 019b |
| 024 | Opponent pixel view | 021, 023 |
| 025 | Round screens wired to the room | 020, 021, 022, 023, 024 |

**4.2 Full match:** a 15-round match plays like the original.

| # | Title |
| --- | --- |
| 026 | Engine: winner stays, streaks, private head start |
| 027 | Head start stage and matchup badges |
| 028 | Round summary, replays, Continue and Start next round |
| 029 | Disconnect rules and the spectator view |

**4.3 Showdown:** the complete game.

| # | Title |
| --- | --- |
| 030 | Engine: showdown |
| 031 | Showdown screens |
| 032 | Results, highlights and Play again |

**4.4 Settings**

| # | Title |
| --- | --- |
| 033 | Host settings and the word-length toggle |

**4.5 Polish:** feels finished.

| # | Title |
| --- | --- |
| 035 | Our animations: drawer handoff, showdown card, correct-guess pulse |
| 036 | Sounds and mute |
| 037 | Home game card and PC layout tuning |

## Done when (whole phase)

- [ ] A full game (15 rounds and the showdown) plays with 4–8 people on phones and PCs
- [ ] Every edge case in the spec has its named test
- [ ] The Cloudflare dashboard after a game night matches the spec's budget (section 19)
- [ ] pnpm typecheck, lint, test pass
