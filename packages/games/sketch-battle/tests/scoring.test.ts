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
  it("is the time between the two teams' correct guesses on the clock, as the original", () => {
    expect(gapMs([12_300, 47_000])).toBe(34_700);
    expect(gapMs([47_000, 12_300])).toBe(34_700);
    expect(gapMs([12_300, null])).toBeNull();
  });

  it("counts the head start in: a team 2 s behind on the clock lost by 2 seconds", () => {
    // The challenger's team drew from 0, the other team from 3 s; they guessed at 10 s and 12 s.
    expect(gapMs([10_000, 12_000])).toBe(2_000);
  });

  it("rounds up to whole seconds when >= 1s, and tenths when < 1s", () => {
    expect(formatGap(400)).toBe("0.4 seconds");
    expect(formatGap(34_700)).toBe("35 seconds");
    expect(formatGap(10_060)).toBe("11 seconds");
    expect(formatGap(10_000)).toBe("10 seconds");
    expect(formatGap(950)).toBe("1 second");
    expect(formatGap(1_000)).toBe("1 second");
    expect(formatGap(1_040)).toBe("2 seconds");
  });

  it("calls a gap under 0.05 s less than a tenth, never 0 seconds", () => {
    expect(formatGap(49)).toBe("less than 0.1 seconds");
    expect(formatGap(0)).toBe("less than 0.1 seconds");
    expect(formatGap(50)).toBe("0.1 seconds");
  });
});
