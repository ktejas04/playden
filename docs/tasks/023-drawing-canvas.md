# 023 — Drawing canvas and stroke batching
Phase: 4.1 (Sketch Battle: core round)
Depends on: 017
Touches: packages/games/sketch-battle/view/{Canvas.tsx, Toolbar.tsx, strokes.ts, useStrokeBatcher.ts}, packages/games/sketch-battle/tests/strokes.test.ts, packages/games/sketch-battle/types.ts
Spec: docs/games/sketch-battle.md section 13; docs/PROJECT.md "Drawing data"

## Rules
- Points are 0–1 relative to the canvas, at a fixed 3:2 aspect, so a drawing looks the same on any screen.
- Tools: pen, eraser, clear; 4 sizes; the palette from 020. Stroke width scales with canvas size.
- The drawer's points are batched every `STROKE_BATCH_MS` (100 ms) into one `stroke` move: `{ id, tool, colour, size, points }` plus continuation batches for long strokes.
- Rendering: replay a list of strokes onto a `<canvas>` with device-pixel-ratio scaling; incoming batches append without redrawing everything.
- Touch, stylus and mouse through Pointer Events. Page scroll is locked while drawing. Drawing outside the canvas edge clips.

## Steps
1. Tests first (`strokes.ts`, pure): coordinate normalising, batching splits and joins back into the same stroke, the clear and eraser operations, size scaling.
2. `Canvas.tsx` (renders strokes; draw mode for the drawer), `Toolbar.tsx` (shadcn toggle group, size dots, colour swatches), `useStrokeBatcher.ts`.
3. A dev-only page or story to try the canvas alone on a phone, removed or hidden behind dev sign-in.

## Done when
- [ ] Tests above pass
- [ ] Manual on a phone over the local network: drawing is smooth, the page doesn't scroll, and the strokes look the same on a second device
- [ ] pnpm typecheck, lint, test pass
