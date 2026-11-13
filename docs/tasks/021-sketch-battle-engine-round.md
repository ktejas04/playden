# 021 — Sketch Battle engine: round flow, guessing and scoring
Phase: 4.1 (Sketch Battle: core round)
Depends on: 015–019, 019b, 019c
Touches: packages/games/sketch-battle/{config.ts, types.ts, engine.ts, scoring.ts, guess.ts, rotation.ts, delta.ts, package.json, tsconfig.json}, packages/games/sketch-battle/tests/*, apps/server/src/games.ts, apps/web/src/games.ts (registry lines only)
Spec: docs/games/sketch-battle.md sections 4–6, 8 (simple rotation for now), 12, 14–17

## Scope for 4.1
- Create the package with `pnpm new-game sketch-battle "Sketch Battle"` (dev-only until it goes live).
- A full round: choose (15 s, timeout picks the first word) → countdown (3 s) → drawing → round end (deadline or both guessed) → result (5 s) → next round, for `rounds` rounds → `result()`.
- Chooser: a random team from the seed every round. Head start is always 0 until 026.
- Rotation: both teams move to their next connected player every round. Winner-stays comes in 026.
- `draw`, `clear` and wrong guesses are live transitions (D55); a correct guess and word choice are not. `delta` per section 15. The pixel cells come in 024.
- `moveLimit` is `STROKE_MOVE_LIMIT`.

## Steps
1. Tests first, using the spec's names (section 20) for everything in scope:
   - scoring: all of it
   - guessing: all of it
   - round flow: ends early, deadline, drawer locks after their team guesses, choose timeout, both drawers get the choices
   - choosing: round 1 chooser team from the seed
   - hidden information: word, choices, other team's strokes
   - setup: 2–8 per team with no size-gap rule; no word offered twice
   - live moves never change the next deadline
2. `config.ts` with every number from section 17, the state types from section 15 in `types.ts`.
3. `guess.ts` (normalising, matching, blanks, the 3-in-3-s limit), `scoring.ts`, `rotation.ts`, `delta.ts`, `engine.ts`.
4. Register the game on the server and the web (the view is a placeholder until 025). Until 022 lands, use a short test word list.

## Done when
- [ ] All tests above pass with fixed seeds and times
- [ ] pnpm typecheck, lint, test pass
