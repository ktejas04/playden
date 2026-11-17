import { settingProblems } from "@playden/ui/lib/settingFields";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, configSchema } from "../config";
import { SKETCH_BATTLE_SETTINGS } from "../view/settings";

/** Host settings (spec section 4, SB19): rounds 5–15, seconds per round 15–120 in 15 s steps, word lengths. */
describe("Sketch Battle settings", () => {
  it("match the config schema and defaults exactly", () => {
    expect(settingProblems(SKETCH_BATTLE_SETTINGS, DEFAULT_CONFIG, configSchema)).toEqual([]);
  });

  it("default to 15 rounds of 45 s with word lengths shown", () => {
    expect(DEFAULT_CONFIG).toEqual({ rounds: 15, roundSeconds: 45, showWordLengths: true });
  });

  it("rounds go from 5 to 15, one at a time", () => {
    const valid = (rounds: number) => configSchema.safeParse({ ...DEFAULT_CONFIG, rounds }).success;
    expect([5, 6, 10, 14, 15].every(valid)).toBe(true);
    expect([3, 4, 16, 25, 7.5].some(valid)).toBe(false);
  });

  it("seconds per round go from 15 to 120 in 15 s steps", () => {
    const valid = (roundSeconds: number) =>
      configSchema.safeParse({ ...DEFAULT_CONFIG, roundSeconds }).success;
    expect([15, 45, 60, 120].every(valid)).toBe(true);
    expect([10, 50, 135].some(valid)).toBe(false);
  });
});
