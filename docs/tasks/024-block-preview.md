# 024 — Opponent pixel view
Phase: 4.1 (Sketch Battle: core round)
Depends on: 021, 023
Touches: packages/games/sketch-battle/{preview.ts, engine.ts, delta.ts, types.ts}, packages/games/sketch-battle/view/PixelView.tsx, packages/games/sketch-battle/tests/preview.test.ts
Spec: docs/games/sketch-battle.md sections 14, 15; D47

## Rules
- The server keeps a 24 × 16 grid per team (`cells`, one character per cell). Each stroke segment marks the cells it crosses, 1 cell wide whatever the brush size, with the stroke's colour. The eraser empties cells; clear empties all.
- The other team gets only the changed cells, in the same delta as the draw move that changed them.
- Once a team has guessed, it gets the other team's full drawing so far once, then live points. Spectators always get real strokes.
- No pixel view in the showdown.

## Steps
1. Tests first:
   - a horizontal line fills one row of cells
   - a diagonal line fills the cells it crosses
   - a thick brush still marks 1 cell wide
   - the eraser and clear empty cells
   - the last colour wins in a cell
   - the other team gets only cells before they guess, and the full drawing after
2. `preview.ts` (pure grid line walk), wired into `apply` and `delta`.
3. `PixelView.tsx` draws the grid as crisp blocks, sized to the opponent strip.

## Done when
- [ ] Tests above pass
- [ ] Manual: with dev tools open, the guessing team's socket never carries the other team's strokes or the word before they guess
- [ ] pnpm typecheck, lint, test pass
