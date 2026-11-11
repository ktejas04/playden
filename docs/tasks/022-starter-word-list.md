# 022 — Starter English word list
Phase: 4.1 (Sketch Battle: core round)
Depends on: —
Touches: packages/games/sketch-battle/words/english.ts, packages/games/sketch-battle/tests/words.test.ts
Spec: docs/games/sketch-battle.md section 16, D45

## Steps
1. Tests first:
   - every word is lowercase English letters and single spaces
   - at most 3 words each
   - no duplicates
   - at least 150 words (enough for 25 rounds at 2 choices, with room to spare)
2. Write about 200 of our own family-friendly words: everyday objects, animals, food, places, actions, and short phrases like "birthday cake". No proper names and nothing copied from another game's list.
3. Mix of easy, medium and a few hard words; note the rough mix in a comment at the top.

## Done when
- [ ] Tests above pass
- [ ] The owner has skimmed the list
- [ ] pnpm typecheck, lint, test pass
