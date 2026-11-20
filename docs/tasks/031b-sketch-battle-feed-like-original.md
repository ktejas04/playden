# 031b — Sketch Battle: guess feed and board layout as the original

Phase: 4.3 (Sketch Battle: showdown), a fix-up after game night
Depends on: 025, 028, 029, 031
Touches: packages/games/sketch-battle/{types.ts,config.ts,showdown.ts,engine.ts,delta.ts}, packages/games/sketch-battle/view/{index.tsx,Feed.tsx,OpponentStrip.tsx,Showdown.tsx,Intermission.tsx,feedMessages.ts,history.ts}, packages/games/sketch-battle/tests/\*, docs/games/sketch-battle.md
Spec: docs/games/sketch-battle.md SB29–SB32, sections 6, 9, 10, 14

The owner's call (2026-11-20): the guess feed and the board around it work as drawbattle.io does, checked against its game code (`MessageLog`, `GuessersMessage`, `OtherTeamView`, `FinalRoundSidebar`, `TeamBoard` and their CSS) on 2026-11-20. Look stays ours (D17). Two deliberate differences stay: the other team's canvas is the pixel view until the round result (SB25, a trial) and only cells ever reach the other team (SB6).

## Steps

Each step: tests first, `pnpm typecheck && pnpm lint && pnpm test`, the engine simulation of 5 rounds and the showdown, a browser check where the step changes screens, then a commit.

1. **Plan and spec.** This file; SB29–SB32 in the spec; SB25 marked as a trial difference; SB27 replaced.
2. **Engine: the showdown feed runs on.** The showdown keeps every finished word's drawer, start and guesses per team (`Showdown.past`). `TeamView.earlier` carries them to that team and to spectators (never the other team, SB4; everyone at the end), and deltas send them when they change. Tests: kept across words, hidden from the other team, delta round-trip.
3. **Feed as the original (SB29).** A pure `feedMessages` builds the lines in time order, per word: the headers asked for ("<drawer> is drawing", one "<a>, <b>, and <c> are guessing" line), then that word's guesses with their time since the word's start. Screens use: a player in a round, drawer and guessers lines; a player in the showdown, a drawer line per word and the whole showdown so far; spectators, the guessers line in a round and guesses only in the showdown; the other team's box and the round summary, guesses only. Phone (600 px and under): newest at the top, the headers at the bottom, no height cap. Wider: oldest at the top in a box as tall as the canvas, kept scrolled to the newest, with a fade at the top once there's more above. A guess's time shows on hover ("12.3s elapsed"). Our pending guesses stay (they're ours, D17). SB27's word history goes. Tests: the guessers line for 0–4 names, message order and headers for each screen, elapsed rounding.
4. **Marks and the other team's box (SB31).** The ✕ / ✓ marks show only in the other team's box, newest first, until your team guesses; then the box shows their guesses instead. No marks under your own canvas or for spectators. The round summary shows each team's guesses under its replay (section 10). Tests: the marks' order.
5. **PC layout (SB32).** Owner's call: keep our two columns (the original's three need the whole window; our page is about 1024 px). Feeds over 600 px show 10 lines, then scroll, kept at the newest, with the fade at the top. Phones and the summary: no cap.
6. **Showdown word table (SB30).** Players on screens over 600 px get the original's table: a column per team, their own first; each row a word: their own team's finished words in green, the other team's finished words as a ✓, a blank line for every word not finished. Hidden on phones. Spectators keep both teams' words (SB22). Tests: the rows a player and a spectator get.
7. **Recheck.** The full simulation, both recordings (PC and phone) and the stress check of many guesses.

## Done when

- [ ] the showdown feed keeps every word, with "<drawer> is drawing" at each handoff, on phone and PC
- [ ] the feed's order, height and hover times match the original on phone (≤ 600 px) and PC
- [ ] the other team's box shows marks before you guess and their guesses after; the summary shows each team's guesses
- [ ] PC feeds scroll after 10 lines, kept at the newest; the showdown table shows on PC, not on phones
- [ ] pnpm typecheck, lint, test pass
