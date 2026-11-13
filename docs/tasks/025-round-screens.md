# 025 — Round screens wired to the room
Phase: 4.1 (Sketch Battle: core round)
Depends on: 020, 021, 022, 023, 024
Touches: packages/games/sketch-battle/view/** (screens), apps/web/src/games.ts (registry line only)
Spec: docs/games/sketch-battle.md sections 5, 6, 13 (S2, S3, S5–S7); the mockups from 020

## Steps
1. Build the screens from the approved mockups, phone first:
   - S2 choose: both drawers see the two word cards (only the chooser's tap), a 15 s ring; others see the matchup and who's choosing
   - S3 countdown
   - S5 drawer: word, timer, canvas, toolbar, team feed, opponent strip
   - S6 guesser: blanks (or one blank line with word lengths off), timer, canvas, the guess box pinned above the keyboard, team feed with "+12.3 s" times, opponent strip
   - S7 result overlay on the canvas
2. Guess box: 36 characters, no pasting, at most 3 guesses in any 3 s (the button waits rather than sending), open only in the drawing stage, locked once the team guesses. Your own guess shows faded until the server confirms it. A refused guess shows the engine's reason under the box.
3. Timers count down to the server's deadline timestamps, corrected by the clock offset from the ping.
4. Motion per section 13: subtle, 150–300 ms, one at a time, off with reduced motion. Both themes, hover and press states.

## Done when
- [ ] Manual with test players: 2 phones + 2 PC windows play 3 rounds end to end; the screens match the mockups; the guess box stays visible above the phone keyboard; a reload mid-round comes back to the same point
- [ ] Screenshots of each screen (phone and PC, light and dark) reviewed by the owner
- [x] pnpm typecheck, lint, test pass
