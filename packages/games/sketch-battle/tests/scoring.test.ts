import { describe, expect, it } from "vitest";
import { formatGap, gapMs, pointsFor } from "../scoring";

describe("round points (SB1)", () => {
  it("first team to guess scores 200 and the second 100, however late", () => {
    expect(pointsFor([1, 0])).toEqual([100, 200]);
    expect(pointsFor([0, 1])).toEqual([200, 100]);
  });

  it("a team that never guesses scores 0", () => {
    expect(pointsFor([1])).toEqual([0, 200]);
  });

  it("nobody guessing scores 0 for both", () => {
    expect(pointsFor([])).toEqual([0, 0]);
  });
});

describe("the won-by gap", () => {
  it("is the time between the two teams' guesses, each from their own drawing start", () => {
    expect(gapMs([12_300, 47_000], [0, 0])).toBe(34_700);
    expect(gapMs([10_000, 9_000], [3_000, 0])).toBe(2_000);
    expect(gapMs([12_300, null], [0, 0])).toBeNull();
  });

  it("shows one decimal under a second and whole seconds rounded up otherwise", () => {
    expect(formatGap(400)).toBe("0.4 seconds");
    expect(formatGap(40)).toBe("0.1 seconds");
    expect(formatGap(999)).toBe("1 second");
    expect(formatGap(1_000)).toBe("1 second");
    expect(formatGap(34_700)).toBe("35 seconds");
  });
});
