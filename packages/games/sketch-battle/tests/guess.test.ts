import { describe, expect, it } from "vitest";
import { blanksFor, guessProblem, isCorrectGuess, normalizeGuess, tooManyGuesses } from "../guess";

describe("guessing (spec section 6)", () => {
  it("guess matching ignores case, accents, spaces and punctuation", () => {
    expect(isCorrectGuess("X-Ray!", "x-ray")).toBe(true);
    expect(isCorrectGuess("xray", "x-ray")).toBe(true);
    expect(isCorrectGuess("Pot  of GOLD", "pot of gold")).toBe(true);
    expect(isCorrectGuess("crème brûlée", "creme brulee")).toBe(true);
    expect(isCorrectGuess("pot of gol", "pot of gold")).toBe(false);
    expect(normalizeGuess(" T-Shirt ")).toBe("tshirt");
  });

  it("a guess with nothing but punctuation never matches", () => {
    expect(isCorrectGuess("!!!", "x-ray")).toBe(false);
  });

  it("guesses over 36 characters are refused", () => {
    expect(guessProblem("a".repeat(36))).toBeNull();
    expect(guessProblem("a".repeat(37))).toBe("Guesses are at most 36 characters");
  });

  it("empty guesses are refused", () => {
    expect(guessProblem("   ")).toBe("Type a guess first");
  });

  it("a 4th guess within 3 s is refused", () => {
    expect(tooManyGuesses([0, 1_000, 2_000], 2_999)).toBe(true);
    expect(tooManyGuesses([0, 1_000, 2_000], 3_000)).toBe(false);
    expect(tooManyGuesses([1_000, 2_000], 2_500)).toBe(false);
  });

  it("blanks hide letters and digits and keep spaces and punctuation", () => {
    expect(blanksFor("pot of gold")).toBe("___ __ ____");
    expect(blanksFor("x-ray")).toBe("_-___");
    expect(blanksFor("7 up")).toBe("_ __");
  });
});
