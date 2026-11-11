# 015 — Seeded randomness
Phase: 3 (Game platform)
Depends on: —
Touches: packages/engine/src/{random.ts, index.ts}, packages/engine/tests/random.test.ts
Spec: docs/PROJECT.md "Game engine contract" (seeded randomness)

## Steps
1. Tests first:
   - the same seed gives the same sequence
   - different seeds differ
   - `nextFloat` stays in [0, 1)
   - `nextInt(min, max)` stays in range and hits both ends over many draws
   - `shuffle` keeps every item and doesn't mutate its input
   - `pick` returns an item of the list
   - the generator state can be saved and restored, so engine state stays plain JSON
2. `random.ts`: a small, well-known 32-bit generator (mulberry32 or sfc32; note its source in one comment) as pure functions over a plain `{ seed: number }` state: `createRandom(seed)`, `nextFloat(rng)`, `nextInt(rng, min, max)`, `shuffle(rng, list)`, `pick(rng, list)`. Each returns the value and the new state, so engine state never holds a class instance.
3. Export from `packages/engine`.

## Done when
- [x] Tests above pass, with fixed seeds and no flakiness, plus pinned outputs checked against the reference mulberry32
- [x] pnpm typecheck, lint, test pass
