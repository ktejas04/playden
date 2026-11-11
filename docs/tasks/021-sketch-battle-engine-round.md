# 021 — Sketch Battle engine: round flow, guessing and scoring
Phase: 4.1 (Sketch Battle: core round)
Depends on: 015, 016, 017, 018
Touches: packages/games/sketch-battle/{config.ts, types.ts, engine.ts, scoring.ts, guess.ts, rotation.ts, package.json, tsconfig.json}, packages/games/sketch-battle/tests/*, apps/server/src/games.ts, apps/web/src/games.ts (registry lines only)
Spec: docs/games/sketch-battle.md sections 3–5, 7 (simple rotation for now), 11, 14, 15

## Scope for 4.1
- A full round: choose (15 s, timeout picks the first word) → countdown → drawing → round end (deadline or both guessed) → result (5 s) → next round, for `rounds` rounds → `result()`.
- Chooser: a random team from the seed every round. Head start is always 0 until 026.
- Rotation: both teams move to their next connected player every round. Winner-stays comes in 026.
- Strokes are accepted as moves and stored per team per round. The block preview comes in 024.

## Steps
1. Tests first, using the spec's names where they apply:
   - first team to guess scores 200
   - second team scores 100 however late
   - team that never guesses scores 0
   - nobody guessing scores 0 for both
   - same-millisecond guesses go to the first processed
   - guess matching ignores case, accents, spaces and punctuation
   - drawers and spectators can't guess
   - a team can't guess again after guessing
   - guesses faster than the minimum interval are rejected
   - guesses over the length cap are rejected
   - the round ends early once both teams have guessed
   - the choose timeout picks the first word
   - round 1 chooser team comes from the seed
   - view hides the word from guessers until their team guesses
   - word choices go only to the chooser
   - no word is offered twice in a game
   - start needs 2–8 players per team and a size gap of at most 1
2. `config.ts` with every number from section 15 (those not used yet included).
3. `guess.ts` (normalising and matching), `scoring.ts` (round points), `rotation.ts` (next connected player), `engine.ts` (the `GameDefinition`, with `moveSchema` for `choose`, `guess`, `stroke`, `clear`).
4. Register the game on the server and the web (the view is a placeholder until 025).

## Done when
- [ ] All tests above pass with fixed seeds and times
- [ ] pnpm typecheck, lint, test pass
