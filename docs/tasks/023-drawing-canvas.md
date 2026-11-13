# 023 — Drawing canvas and stroke sending
Phase: 4.1 (Sketch Battle: core round)
Depends on: 019b
Touches: packages/games/sketch-battle/view/{Canvas.tsx, Toolbar.tsx, strokes.ts, useStrokeSender.ts, usePlayback.ts}, packages/games/sketch-battle/tests/strokes.test.ts, packages/games/sketch-battle/types.ts
Spec: docs/games/sketch-battle.md sections 14, 15

## Rules
- Canvas 3:2. Points are whole numbers, x 0–1500 and y 0–1000; points closer than 4 units to the last are dropped.
- Tools: pen, eraser (paints the background), clear; 4 sizes (1%, 2%, 5%, 10% of the canvas width); the 10 colours from 020. Starts black, size 1.
- Sending: one `draw` move at most every 150 ms while the pen moves; the first point after a pause goes at once (with `start`), and pen-up goes at once with the remaining points (`end`). Points in a move are delta-encoded.
- Receiving: new points are added to the canvas and spread over the next 150 ms; nothing already drawn is redrawn. A `clear` wipes it.
- Replay: redraw all strokes in order, one step every 10 ms.
- Touch, stylus and mouse through Pointer Events. Page scroll is locked while drawing. Drawing outside the edge clips.

## Steps
1. Tests first (`strokes.ts`, pure): coordinate normalising, the 4-unit filter, delta encoding and decoding, batch timing (immediate pen-down and pen-up, 150 ms in between), clear and eraser, size scaling.
2. `Canvas.tsx`, `Toolbar.tsx` (shadcn toggle group, size dots, colour swatches), `useStrokeSender.ts`, `usePlayback.ts`.
3. A dev-only page to try the canvas alone on a phone, hidden behind dev sign-in. Try 100 ms and 150 ms batches on two phones; keep the better one in `config.ts`.

## Done when
- [x] Tests above pass
- [ ] Manual on two phones over the local network: drawing is smooth on both, lines start and end without delay, the page doesn't scroll, and strokes look the same on both
- [x] pnpm typecheck, lint, test pass
