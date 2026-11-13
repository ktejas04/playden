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
- Until the round summary (028), the result stage leads straight to the next round, but only once each team has at least 2 connected players (SB12, using `onPresence` from 019c); until then the result stays up with "Waiting for <team>".
- `recordSummary(state)`: each finished round's word, drawers, winning team and gap (the showdown and highlights come in 030 and 032).

## Steps
1. Tests first, using the spec's names (section 20) for everything in scope:
   - scoring: all of it
   - guessing: all of it
   - round flow: ends early, deadline, drawer locks after their team guesses, choose timeout, both drawers get the choices
   - choosing: round 1 chooser team from the seed
   - hidden information: word, choices, other team's strokes
   - setup: 2–8 per team with no size-gap rule; no word offered twice
   - live moves never change the next deadline
   - a round plays on and times out when a team has nobody connected
   - the next round waits until each team has 2 connected players
   - the record summary lists each round's word, drawers, winner and gap
2. `config.ts` with every number from section 17, the state types from section 15 in `types.ts`.
3. `guess.ts` (normalising, matching, blanks, the 3-in-3-s limit), `scoring.ts`, `rotation.ts`, `delta.ts`, `engine.ts`.
4. Register the game on the server and the web (the view is a placeholder until 025). Until 022 lands, use a short test word list.

## Done when
- [x] All tests above pass with fixed seeds and times
- [x] pnpm typecheck, lint, test pass
