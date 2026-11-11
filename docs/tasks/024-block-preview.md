# 024 — Block preview of the other team
Phase: 4.1 (Sketch Battle: core round)
Depends on: 021, 023
Touches: packages/games/sketch-battle/{preview.ts, engine.ts, types.ts}, packages/games/sketch-battle/view/BlockPreview.tsx, packages/games/sketch-battle/tests/preview.test.ts
Spec: docs/games/sketch-battle.md section 13, D47

## Rules
- For a team that hasn't guessed yet, `view` replaces the other team's strokes with a `PREVIEW_COLS × PREVIEW_ROWS` (30 × 20) grid of colour cells.
- Each stroke segment marks the cells it passes through (a line walk across the grid) with the stroke's colour. The eraser empties cells. Clear empties all.
- The preview in a player's view updates at most every `PREVIEW_INTERVAL_MS` (500 ms) of server time.
- Once a team has guessed, its players get the other team's real strokes. Spectators always get real strokes.

## Steps
1. Tests first:
   - a horizontal line fills one row of cells
   - a diagonal line fills the cells it crosses
   - the eraser and clear empty cells
   - the last colour wins in a cell
   - view sends the other team only the block preview before they guess
   - view sends real strokes after the team guesses
   - the preview is throttled to its interval
2. `preview.ts` (pure grid building), wired into `view`.
3. `BlockPreview.tsx` renders the grid as crisp blocks, sized to the opponent strip.

## Done when
- [ ] Tests above pass
- [ ] Manual: with dev tools open, the guessing team's socket never carries the other team's strokes before they guess
- [ ] pnpm typecheck, lint, test pass
