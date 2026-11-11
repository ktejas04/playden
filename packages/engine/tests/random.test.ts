import { describe, expect, it } from "vitest";
import { type Rng, createRng, nextFloat, nextInt, pick, shuffle } from "../src/random";

/** Draws `count` floats in a row, threading the generator through. */
function floats(rng: Rng, count: number): number[] {
  const out: number[] = [];
  let current = rng;
  for (let i = 0; i < count; i++) {
    const { value, rng: next } = nextFloat(current);
    out.push(value);
    current = next;
  }
  return out;
}

describe("createRng", () => {
  it("gives the same sequence for the same seed", () => {
    expect(floats(createRng(42), 20)).toEqual(floats(createRng(42), 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(floats(createRng(1), 5)).not.toEqual(floats(createRng(2), 5));
  });

  it("accepts any integer seed, including 0 and negatives", () => {
    for (const seed of [0, -1, 2 ** 31, 2 ** 32 + 5, Number.MAX_SAFE_INTEGER]) {
      const values = floats(createRng(seed), 3);
      expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    }
  });

  it("rejects a seed that isn't an integer", () => {
    expect(() => createRng(1.5)).toThrow(RangeError);
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
  });
});

describe("fixed algorithm", () => {
  // Saved games replay from their seed, so these exact values must never change.
  // They match the reference mulberry32 implementation.
  it("produces the pinned numbers for seed 2026", () => {
    let rng = createRng(2026);
    const values: number[] = [];
    for (let i = 0; i < 8; i++) {
      const drawn = nextInt(rng, 1, 100);
      values.push(drawn.value);
      rng = drawn.rng;
    }
    expect(values).toEqual([46, 31, 67, 62, 16, 23, 69, 81]);
  });

  it("produces the pinned shuffle for seed 2026", () => {
    const { value } = shuffle(createRng(2026), ["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(value).toEqual(["g", "b", "e", "a", "f", "h", "c", "d"]);
  });
});

describe("generator state", () => {
  it("is plain JSON: saving and loading it continues the same sequence", () => {
    let rng = createRng(7);
    rng = nextFloat(rng).rng;
    const restored = JSON.parse(JSON.stringify(rng)) as Rng;
    expect(floats(restored, 10)).toEqual(floats(rng, 10));
  });

  it("is never changed in place", () => {
    const rng = createRng(9);
    const before = JSON.stringify(rng);
    nextFloat(rng);
    nextInt(rng, 1, 6);
    shuffle(rng, [1, 2, 3]);
    pick(rng, ["a", "b"]);
    expect(JSON.stringify(rng)).toBe(before);
  });
});

describe("nextFloat", () => {
  it("stays in [0, 1)", () => {
    expect(floats(createRng(3), 10_000).every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("nextInt", () => {
  it("stays in range and reaches both ends", () => {
    let rng = createRng(11);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const drawn = nextInt(rng, 1, 6);
      seen.add(drawn.value);
      rng = drawn.rng;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("returns the only value when min equals max", () => {
    expect(nextInt(createRng(1), 4, 4).value).toBe(4);
  });

  it("rejects bad bounds", () => {
    expect(() => nextInt(createRng(1), 5, 1)).toThrow(RangeError);
    expect(() => nextInt(createRng(1), 0.5, 2)).toThrow(RangeError);
  });
});

describe("shuffle", () => {
  it("keeps every item and doesn't change the input", () => {
    const input = Object.freeze(["a", "b", "c", "d", "e", "f"]);
    const { value } = shuffle(createRng(5), input);
    expect([...value].sort()).toEqual([...input]);
    expect(input).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("is the same for the same seed and differs across seeds", () => {
    const deck = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(createRng(8), deck).value).toEqual(shuffle(createRng(8), deck).value);
    expect(shuffle(createRng(8), deck).value).not.toEqual(shuffle(createRng(9), deck).value);
  });

  it("handles empty and single-item lists", () => {
    expect(shuffle(createRng(1), []).value).toEqual([]);
    expect(shuffle(createRng(1), ["only"]).value).toEqual(["only"]);
  });

  it("puts each item first about equally often", () => {
    let rng = createRng(21);
    const firsts = new Map<number, number>();
    const runs = 8_000;
    for (let i = 0; i < runs; i++) {
      const shuffled = shuffle(rng, [0, 1, 2, 3]);
      rng = shuffled.rng;
      const first = shuffled.value[0] ?? -1;
      firsts.set(first, (firsts.get(first) ?? 0) + 1);
    }
    expect([...firsts.keys()].sort()).toEqual([0, 1, 2, 3]);
    for (const count of firsts.values()) {
      expect(Math.abs(count / runs - 0.25)).toBeLessThan(0.03);
    }
  });
});

describe("pick", () => {
  it("returns an item of the list", () => {
    const list = ["red", "green", "blue"];
    let rng = createRng(4);
    for (let i = 0; i < 50; i++) {
      const picked = pick(rng, list);
      expect(list).toContain(picked.value);
      rng = picked.rng;
    }
  });

  it("rejects an empty list", () => {
    expect(() => pick(createRng(1), [])).toThrow(RangeError);
  });
});
