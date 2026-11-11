/**
 * Seeded randomness for game engines. Engines never call Math.random(): every shuffle and
 * draw threads an `Rng` through these pure functions, so a game replays exactly from its
 * seed and moves. The generator is plain JSON, so it lives inside game state as is.
 *
 * Changing the algorithm changes every past game's replay, so keep it fixed.
 */

/** Generator state: a 32-bit integer. Store it in game state; never mutate it. */
export interface Rng {
  readonly state: number;
}

/** A drawn value and the generator to use for the next draw. */
export interface Drawn<T> {
  value: T;
  rng: Rng;
}

const TWO_POW_32 = 4_294_967_296;

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) throw new RangeError(`Seed must be an integer, got ${seed}`);
  // `| 0` wraps any integer into 32 bits, so large seeds still work.
  return { state: seed | 0 };
}

/** A float in [0, 1). */
export function nextFloat(rng: Rng): Drawn<number> {
  // mulberry32 by Tommy Ettinger (public domain): small, fast, good enough for games.
  const state = (rng.state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32, rng: { state } };
}

/** An integer from `min` to `max`, both included. */
export function nextInt(rng: Rng, min: number, max: number): Drawn<number> {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new RangeError(`Bad range ${min}..${max}`);
  }
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}

/** A shuffled copy (Fisher–Yates); the input is left as it was. */
export function shuffle<T>(rng: Rng, items: readonly T[]): Drawn<T[]> {
  const out = [...items];
  let current = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const drawn = nextInt(current, 0, i);
    current = drawn.rng;
    [out[i], out[drawn.value]] = [out[drawn.value] as T, out[i] as T];
  }
  return { value: out, rng: current };
}

/** One item, chosen evenly. */
export function pick<T>(rng: Rng, items: readonly T[]): Drawn<T> {
  if (items.length === 0) throw new RangeError("Can't pick from an empty list");
  const drawn = nextInt(rng, 0, items.length - 1);
  return { value: items[drawn.value] as T, rng: drawn.rng };
}
