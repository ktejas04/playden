# 031 — Sketch Battle: showdown screens

Phase: 4.3 (Sketch Battle: showdown)
Depends on: 030
Touches: packages/games/sketch-battle/view/\*
Spec: docs/games/sketch-battle.md sections 9, 13 (S9, S10)

## Steps

1. S9 intro: the title card dealt in, the word count, each team's lineup in drawing order, the 10 s count; then the 3-2-1 over the canvas.
2. S10 play: the player's own canvas, tools or guess box and feed as in a round; the running score in words finished ("2 – 1") in the status bar; no opponent canvas, no word tracks (SB18). A 2 s handoff note on the canvas when the pencil passes.
3. Spectators: both canvases with each team's current word.
4. The 5 s result: the game's outcome for this viewer and the final scores, then the results screen.

## Done when

- [ ] a 3-round game reaches the showdown and plays to the end with 4 players on phone and PC, both themes
- [ ] pnpm typecheck, lint, test pass
