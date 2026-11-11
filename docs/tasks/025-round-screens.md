# 025 — Round screens wired to the room
Phase: 4.1 (Sketch Battle: core round)
Depends on: 020, 021, 023, 024
Touches: packages/games/sketch-battle/view/** (screens), apps/web/src/games.ts (registry line only)
Spec: docs/games/sketch-battle.md sections 4, 5, 12 (S1–S3, S5–S7); the mockups from 020

## Steps
1. Build the screens from the approved mockups, phone first:
   - S1 lobby (uses the platform's TeamsPanel from 018, plus the game's start rules)
   - S2 choose: the chooser's two word cards with a 15 s ring; others see who's choosing
   - S3 countdown
   - S5 drawer: word, timer, canvas, toolbar, team feed, opponent strip
   - S6 guesser: blanks, timer, canvas, the guess box pinned above the keyboard, team feed, opponent strip
   - S7 result overlay on the canvas
2. Timers count down to the server's deadline timestamps, corrected by the clock offset from the join ping.
3. Rejected guesses show the engine's reason inline under the guess box.
4. Both themes, hover and press states, reduced motion respected.

## Done when
- [ ] Manual with test players: 2 phones + 2 PC windows play 3 rounds end to end; the screens match the mockups; the guess box stays visible above the phone keyboard
- [ ] Screenshots of each screen (phone and PC, light and dark) reviewed by the owner
- [ ] pnpm typecheck, lint, test pass
