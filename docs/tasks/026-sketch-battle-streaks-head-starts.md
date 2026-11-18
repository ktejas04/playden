# 026 — Sketch Battle engine: streaks and head starts

Phase: 4.2 (Sketch Battle: full match)
Depends on: 021, 028
Touches: packages/games/sketch-battle/{types.ts, engine.ts, streak.ts, scoring.ts, view/result.ts}, packages/games/sketch-battle/tests/{engine,streak,showdown,result,scoring}.test.ts, docs/games/sketch-battle.md (SB24)
Spec: docs/games/sketch-battle.md sections 5 (stage 3), 7, 8 (example), 15, 16, 20 (Streaks and head starts, Round flow, Hidden information); SB2, SB4; D15, D44

## Steps

1. Re-check streaks and head starts against drawbattle.io's game code; stop and report if anything differs from section 7.
2. Tests first, from section 20's "Streaks and head starts" list, the head-start lines in "Round flow" and "Hidden information", and section 8's worked example.
3. `streak.ts`: `streakFor(history, nextDrawers)` counts the rounds in a row won by the same team with the same drawer, only if that drawer draws for that team in the coming round; `headStartFor(streak)` gives 0 below 2, then `3 + (streak − 2)` s, capped only when `HEAD_START_MAX_SECONDS` is set.
4. The challenger's head start is set when the round opens: 0 in round 1 and after a no-winner round (D44).
5. A `headStart` phase between the countdown and the drawing when `h > 0`: only the chooser draws, nobody guesses, and the drawing deadline (`nextDeadline`) counts from the head start's end. The chooser's `drawFrom` is the countdown's end, the other drawer's the head start's end.
6. Views: during the head start the chooser's canvas goes only to the chooser and spectators; the chooser's teammates get no strokes and the other team no pixel cells. Every view gets `streak` and `headStartSeconds`: the round's while it plays, the coming round's from the result on, none in the showdown.
7. `RoundRecord` and `recordSummary` keep each round's `headStartSeconds`. Deltas follow from the views.
8. The "won by" gap is the clock time between the two correct guesses, the head start included, as the original's code (SB24).

## Done when

- [x] every "Streaks and head starts" test in section 20 passes, plus the head-start round-flow and hidden-information tests and section 8's example
- [x] the contract kit plays random games through head starts
- [x] pnpm typecheck, lint, test pass
