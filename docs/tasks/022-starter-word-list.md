# 022 — Sketch Battle word list
Phase: 4.1 (Sketch Battle: core round)
Depends on: — (021 for the package folder)
Touches: packages/games/sketch-battle/words/english.ts, packages/games/sketch-battle/tests/words.test.ts, docs/games/sketch-battle-words.txt (deleted once moved), docs/games/sketch-battle.md section 18
Spec: docs/games/sketch-battle.md section 18, D45

## Steps
1. Tests first:
   - every word is lowercase letters, digits, single spaces and single hyphens
   - 1 to 4 space-separated parts (a hyphenated word counts as one)
   - no duplicates, including after normalising (so "x-ray" and "xray" can't both exist)
   - 2,500 entries: 2,000 easy, 350 medium, 150 hard
   - every difficulty is easy, medium or hard
2. Move `docs/games/sketch-battle-words.txt` into `words/english.ts` as `{ word, difficulty }` entries, unchanged. Delete the `.txt`; `english.ts` is now the source of truth. Keep `sketch-battle-words.pdf` as the printable snapshot.
3. The engine's word order uses this list (021 used a test list until now).

## Done when
- [x] Tests above pass
- [x] pnpm typecheck, lint, test pass
