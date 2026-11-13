# 020 — Sketch Battle screen mockups and the feel
Phase: 4.1 (Sketch Battle: core round)
Depends on: —
Touches: none in the repo (a reviewable mockup page); choices go in docs/games/sketch-battle.md sections 13 and 14
Spec: docs/games/sketch-battle.md sections 5, 13, 14; docs/PROJECT.md D34

## Steps
1. Mock up, phone first then PC, in both themes. Use PlayDen's card-table identity (D34) and shadcn components. Nothing from the original game's look.
   - S2 choose (the chooser's view, the other drawer's view, everyone else's matchup)
   - S4 head start (the chooser, and everyone else's covered canvas)
   - S5 drawer with the toolbar (pen, eraser, clear, 4 sizes, 10 colours)
   - S6 guesser, with the keyboard open, the blanks and the feed with "+12.3 s" times
   - S7 round result
   - the opponent strip with the 24 × 16 pixel view
2. Show the feel from section 13: one example each of the correct-guess pulse, the score tick-up and the result overlay, at 150–300 ms.
3. Decide and note in the spec:
   - team names and colours
   - the 10 palette shades, readable in both themes
   - where the opponent strip sits on a phone
   - the guess feed style
4. Review with the owner; adjust; record the final choices.

## Done when
- [ ] The owner has approved the mockups and the motion examples
- [ ] Sections 13 and 14 of the spec have the chosen layout, team colours and palette
