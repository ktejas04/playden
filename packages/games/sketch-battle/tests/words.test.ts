import { describe, expect, it } from "vitest";
import { normalizeGuess } from "../guess";
import { ENGLISH_WORDS } from "../words/english";

/** Task 022: our own list (spec section 18), checked entry by entry. */
describe("the English word list", () => {
  const words = ENGLISH_WORDS.map((entry) => entry.word);

  it("every word is lowercase letters, digits, single spaces and single hyphens", () => {
    const bad = words.filter((w) => !/^[a-z0-9]+(-[a-z0-9]+)*( [a-z0-9]+(-[a-z0-9]+)*)*$/.test(w));
    expect(bad).toEqual([]);
  });

  it("has 1 to 4 space-separated parts (a hyphenated word counts as one)", () => {
    expect(words.filter((w) => w.split(" ").length > 4)).toEqual([]);
  });

  it("has no duplicates, including after normalising", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const word of words) {
      const key = normalizeGuess(word);
      const other = seen.get(key);
      if (other !== undefined) clashes.push(`${other} / ${word}`);
      seen.set(key, word);
    }
    expect(clashes).toEqual([]);
  });

  it("has 2,500 entries: 2,000 easy, 350 medium, 150 hard", () => {
    const count = (difficulty: string) =>
      ENGLISH_WORDS.filter((entry) => entry.difficulty === difficulty).length;
    expect(ENGLISH_WORDS).toHaveLength(2500);
    expect([count("easy"), count("medium"), count("hard")]).toEqual([2000, 350, 150]);
  });

  it("every difficulty is easy, medium or hard", () => {
    expect(new Set(ENGLISH_WORDS.map((e) => e.difficulty))).toEqual(
      new Set(["easy", "medium", "hard"]),
    );
  });
});
