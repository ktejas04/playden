# 027 — Sketch Battle: head start stage and summary badges

Phase: 4.2 (Sketch Battle: full match)
Depends on: 025, 026, 028
Touches: packages/games/sketch-battle/view/{index.tsx, Badges.tsx, Overlays.tsx, StatusBar.tsx, Intermission.tsx, timer.ts}, packages/games/sketch-battle/{config.ts, scoring.ts, engine.ts, view/result.ts, tests/timer.test.ts, tests/scoring.test.ts, tests/engine.test.ts}, docs/games/sketch-battle.md (SB23)
Spec: docs/games/sketch-battle.md sections 5 (stage 3), 6, 7, 10, 13 (S4, S8, S12); SB4, SB15, SB23, SB24

## Steps

1. S4, the head start (SB23): the chooser draws as normal. Everyone else, the chooser's teammates included, sees a blank canvas with no message (the other team a blank pixel view); the other drawer has no tools until it ends, and the guess box stays locked. Spectators see the chooser's canvas live.
2. Badges, from `@playden/ui` components: a "2x streak" badge for the staying drawer and a "3s head start" badge for the challenger, on the round summary's drawer change only (SB23). Badges only: no "winner" / "next challenger" labels (SB15).
3. The "won by" gap is clock time between the two correct guesses, the head start included, as the original (SB24): `gapMs` in `scoring.ts`, test first.
4. Keep the owner's UI taste: narrow xl CTAs, one colour per line, no filler labels.
5. Check in the browser with the test players (Asha, Ben, Chi, Dev playing, Esha spectating) on phone and PC, both themes: two wins in a row give the challenger 3 s, three give 4 s; nobody can guess during the head start; spectators see the head-start canvas; the badges.

## Done when

- [x] the head start stage and badges work for drawers, guessers and spectators on phone and PC, in both themes
- [ ] the owner has tried it and said it's good
- [x] pnpm typecheck, lint, format:check, test pass
