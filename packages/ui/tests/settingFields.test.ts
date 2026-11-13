import { describe, expect, it } from "vitest";
import {
  type ConfigSchema,
  type SettingField,
  settingProblems,
  settingText,
  stepSetting,
} from "../src/lib/settingFields";

/** Stands in for a game's zod schema: rounds 10/15/20, seconds 15–120, lengths on/off. */
const schema: ConfigSchema = {
  safeParse: (value) => {
    const v = value as Record<string, unknown>;
    const ok =
      [10, 15, 20].includes(v.rounds as number) &&
      Number.isInteger(v.seconds) &&
      (v.seconds as number) >= 15 &&
      (v.seconds as number) <= 120 &&
      typeof v.lengths === "boolean";
    return { success: ok };
  },
};
const defaults = { rounds: 15, seconds: 60, lengths: true };

const rounds: SettingField = {
  key: "rounds",
  label: "Rounds",
  kind: "choice",
  options: [
    { value: 10, label: "10 rounds" },
    { value: 15, label: "15 rounds" },
    { value: 20, label: "20 rounds" },
  ],
};
const seconds = {
  key: "seconds",
  label: "Seconds per round",
  kind: "number",
  min: 15,
  max: 120,
  step: 15,
  unit: "s",
} as const satisfies SettingField;
const lengths: SettingField = { key: "lengths", label: "Show word lengths", kind: "toggle" };

describe("settingText", () => {
  it("says each kind of value in words", () => {
    expect(settingText(seconds, 60)).toBe("60 s");
    expect(settingText(rounds, 15)).toBe("15 rounds");
    expect(settingText(lengths, true)).toBe("On");
    expect(settingText(lengths, false)).toBe("Off");
  });
});

describe("stepSetting", () => {
  it("moves by one step and stops at the ends", () => {
    expect(stepSetting(seconds, 60, 1)).toBe(75);
    expect(stepSetting(seconds, 60, -1)).toBe(45);
    expect(stepSetting(seconds, 120, 1)).toBe(120);
    expect(stepSetting(seconds, 15, -1)).toBe(15);
  });
});

describe("settingProblems", () => {
  it("passes fields that match the schema and defaults", () => {
    expect(settingProblems([rounds, seconds, lengths], defaults, schema)).toEqual([]);
  });

  it("catches a key missing from the defaults or listed twice", () => {
    const ghost: SettingField = { key: "speed", label: "Speed", kind: "toggle" };
    expect(settingProblems([ghost, lengths, lengths], defaults, schema)).toEqual([
      'setting "speed" isn\'t in defaultConfig',
      'setting "lengths" is listed twice',
    ]);
  });

  it("catches a number range that doesn't match the schema", () => {
    const wide = { ...seconds, max: 150 };
    const narrow = { ...seconds, min: 30 };
    expect(settingProblems([wide], defaults, schema).join()).toMatch(/isn't all accepted/);
    expect(settingProblems([narrow], defaults, schema).join()).toMatch(/narrower than/);
  });

  it("catches a default off its step, and choices the schema refuses", () => {
    expect(settingProblems([seconds], { ...defaults, seconds: 50 }, schema).join()).toMatch(
      /isn't on a 15 step/,
    );
    const extra: SettingField = {
      ...rounds,
      options: [...rounds.options, { value: 25, label: "25" }],
    };
    expect(settingProblems([extra], defaults, schema)).toEqual([
      'setting "rounds" option 25 fails configSchema',
    ]);
  });
});
